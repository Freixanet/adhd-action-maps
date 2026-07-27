import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock, requestMock, closeMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  requestMock: vi.fn(),
  closeMock: vi.fn(async () => undefined),
}));

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

vi.mock("undici", () => ({
  Agent: class {
    close = closeMock;
  },
  request: requestMock,
}));

import { SecureFetchError, secureFetch } from "./secureFetcher";

function response(options?: {
  statusCode?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
}) {
  const chunks = options?.chunks ?? [];
  return {
    statusCode: options?.statusCode ?? 200,
    headers: options?.headers ?? { "content-type": "text/plain" },
    body: {
      destroy: vi.fn(),
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      },
    },
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({
    name: "SecureFetchError",
    code,
  });
}

describe("secureFetch SSRF policy", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    requestMock.mockReset();
    closeMock.mockClear();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://169.254.169.254/",
  ])("blocks %s before any network request", async (url) => {
    await expect(secureFetch(url)).rejects.toMatchObject({
      name: "SecureFetchError",
      httpStatus: 403,
      message: "SSRF_BLOCKED",
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("blocks IPv4-mapped private IPv6", async () => {
    await expectCode(secureFetch("http://[::ffff:127.0.0.1]/"), "private_ip");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("blocks a hostname resolving only to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "192.168.1.20", family: 4 }]);
    await expectCode(secureFetch("https://private.example/"), "private_ip");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("fails closed when DNS returns mixed public and private answers", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.2", family: 4 },
    ]);
    await expectCode(secureFetch("https://mixed.example/"), "private_ip");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("revalidates and blocks a redirect to a private address", async () => {
    requestMock.mockResolvedValue(
      response({
        statusCode: 302,
        headers: { location: "http://127.0.0.1/admin" },
      })
    );

    await expectCode(secureFetch("https://public.example/"), "private_ip");
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("stops after three redirects", async () => {
    requestMock
      .mockResolvedValueOnce(
        response({ statusCode: 302, headers: { location: "/one" } })
      )
      .mockResolvedValueOnce(
        response({ statusCode: 302, headers: { location: "/two" } })
      )
      .mockResolvedValueOnce(
        response({ statusCode: 302, headers: { location: "/three" } })
      )
      .mockResolvedValueOnce(
        response({ statusCode: 302, headers: { location: "/four" } })
      );

    await expectCode(secureFetch("https://public.example/start"), "too_many_redirects");
    expect(requestMock).toHaveBeenCalledTimes(4);
  });

  it("aborts a body larger than 5 MiB", async () => {
    requestMock.mockResolvedValue(
      response({
        headers: { "content-type": "text/plain" },
        chunks: [Buffer.alloc(5 * 1024 * 1024 + 1)],
      })
    );

    await expectCode(secureFetch("https://public.example/large"), "too_large");
  });

  it("uses one eight-second timeout budget", async () => {
    vi.useFakeTimers();
    lookupMock.mockReturnValue(new Promise(() => undefined));

    const pending = secureFetch("https://slow.example/");
    const assertion = expectCode(pending, "timeout");
    await vi.advanceTimersByTimeAsync(8_001);
    await assertion;
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("rejects a disallowed MIME before reading the body", async () => {
    const blocked = response({
      headers: { "content-type": "application/octet-stream" },
      chunks: [Buffer.from("secret")],
    });
    requestMock.mockResolvedValue(blocked);

    await expectCode(secureFetch("https://public.example/file"), "disallowed_mime");
    expect(blocked.body.destroy).toHaveBeenCalledTimes(1);
  });

  it("extracts readable HTML without regex tag stripping", async () => {
    requestMock.mockResolvedValue(
      response({
        headers: { "content-type": "text/html; charset=utf-8" },
        chunks: [
          Buffer.from(`
            <!doctype html>
            <html>
              <head><title>Documento seguro</title></head>
              <body>
                <article>
                  <h1>Documento seguro</h1>
                  <p>Este texto contiene suficiente contexto para que Readability extraiga el artículo principal correctamente.</p>
                  <p>La segunda parte confirma que el contenido útil queda disponible para la transformación.</p>
                </article>
              </body>
            </html>
          `),
        ],
      })
    );

    const result = await secureFetch("https://public.example/article");
    expect(result.title).toContain("Documento seguro");
    expect(result.text).toContain("Readability extraiga");
    expect(result.canonicalUrl).toBe("https://public.example/article");
  });

  it("rejects credentials and non-http protocols", async () => {
    await expectCode(
      secureFetch("https://user:pass@public.example/"),
      "credentials_not_allowed"
    );
    await expectCode(secureFetch("file:///etc/passwd"), "unsupported_protocol");
    await expectCode(secureFetch("gopher://public.example/"), "unsupported_protocol");
    await expectCode(secureFetch("ftp://public.example/"), "unsupported_protocol");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("returns typed errors", () => {
    const error = new SecureFetchError("private_ip", "SSRF_BLOCKED", 403);
    expect(error).toBeInstanceOf(Error);
  });
});
