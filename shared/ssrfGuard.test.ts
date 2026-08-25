import { describe, expect, it } from "vitest";
import { assertSafeFetchUrl } from "./ssrfGuard.ts";

describe("ssrfGuard", () => {
  it("rejects non-http protocols", async () => {
    const result = await assertSafeFetchUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost", async () => {
    const result = await assertSafeFetchUrl("http://localhost/secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked_hostname");
  });

  it("rejects private IPv4 literals", async () => {
    const result = await assertSafeFetchUrl("http://127.0.0.1/x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("private_ip");
  });

  it("rejects credentials in URL", async () => {
    const result = await assertSafeFetchUrl("https://user:pass@example.com/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credentials_not_allowed");
  });

  it("allows public https hosts", async () => {
    const result = await assertSafeFetchUrl("https://example.com/path");
    expect(result.ok).toBe(true);
  });
});
