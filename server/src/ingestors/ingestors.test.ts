import { afterEach, describe, expect, it } from "vitest";
import { isAskLaneInput } from "./askLane";
import { getIngestor, IngestError } from "./factory";
import type { TransformRequest } from "../../../shared/contracts";

describe("isAskLaneInput", () => {
  it("routes short Spanish questions to ask", () => {
    expect(
      isAskLaneInput({ type: "text", text: "¿qué es el TDAH?" } as TransformRequest)
    ).toBe(true);
    expect(
      isAskLaneInput({ type: "text", text: "cómo funciona la memoria de trabajo" } as TransformRequest)
    ).toBe(true);
  });

  it("rejects long text, files, urls, and source types", () => {
    expect(
      isAskLaneInput({
        type: "text",
        text: "¿" + "x".repeat(220) + "?",
      } as TransformRequest)
    ).toBe(false);
    expect(
      isAskLaneInput({
        type: "text",
        text: "https://example.com/article",
      } as TransformRequest)
    ).toBe(false);
    expect(
      isAskLaneInput({
        type: "pdf",
        text: "¿qué es?",
        fileData: "abc",
      } as TransformRequest)
    ).toBe(false);
    expect(
      isAskLaneInput({ type: "link", text: "¿qué es?" } as TransformRequest)
    ).toBe(false);
  });
});

describe("getIngestor feature flag", () => {
  afterEach(() => {
    delete process.env.ENABLE_EXPANDED_INPUTS;
  });

  it("returns 501 for epub/image when ENABLE_EXPANDED_INPUTS is false", () => {
    process.env.ENABLE_EXPANDED_INPUTS = "false";
    expect(() =>
      getIngestor({ mime: "application/epub+zip", ext: "epub", size: 100 })
    ).toThrow(IngestError);
    try {
      getIngestor({ mime: "image/jpeg", ext: "jpg", size: 100 });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(IngestError);
      expect((err as IngestError).code).toBe("FEATURE_DISABLED");
      expect((err as IngestError).httpStatus).toBe(501);
    }
  });

  it("selects epub/image when flag is true", () => {
    process.env.ENABLE_EXPANDED_INPUTS = "true";
    expect(getIngestor({ mime: "application/epub+zip", ext: "epub", size: 100 }).canHandle({
      mime: "application/epub+zip",
    })).toBe(true);
    expect(
      getIngestor({ mime: "image/jpeg", ext: "jpg", size: 100 }).canHandle({
        mime: "image/jpeg",
      })
    ).toBe(true);
  });

  it("enforces size limits", () => {
    process.env.ENABLE_EXPANDED_INPUTS = "true";
    try {
      getIngestor({
        mime: "application/epub+zip",
        ext: "epub",
        size: 21 * 1024 * 1024,
      });
      expect.fail("expected throw");
    } catch (err) {
      expect((err as IngestError).code).toBe("FILE_TOO_LARGE");
    }
    try {
      getIngestor({
        mime: "image/png",
        ext: "png",
        size: 11 * 1024 * 1024,
      });
      expect.fail("expected throw");
    } catch (err) {
      expect((err as IngestError).code).toBe("FILE_TOO_LARGE");
    }
  });
});

describe("prepareTransformIngest ask lane", () => {
  it("returns kind ask without creating chunks", async () => {
    const { prepareTransformIngest } = await import("../routes/transformIngest");
    const outcome = await prepareTransformIngest({
      type: "text",
      text: "¿qué es el TDAH?",
    } as TransformRequest);
    expect(outcome.kind).toBe("ask");
  });

  it("returns 501 for epub when flag off", async () => {
    process.env.ENABLE_EXPANDED_INPUTS = "false";
    const { prepareTransformIngest } = await import("../routes/transformIngest");
    const outcome = await prepareTransformIngest({
      type: "text",
      text: "",
      mimeType: "application/epub+zip",
      sourceLabel: "book.epub",
      fileData: Buffer.from("not-a-real-epub").toString("base64"),
    } as TransformRequest);
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.status).toBe(501);
      expect(outcome.code).toBe("FEATURE_DISABLED");
    }
  });
});
