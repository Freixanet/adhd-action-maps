import { describe, expect, it } from "vitest";
import {
  generatedMapSchema,
  geminiChatSchema,
  geminiErrorSchema,
  geminiPdfAnalysisSchema,
  mapChatRequestSchema,
  mapPayloadSchema,
  sdkErrorSchema,
  serverEnvSchema,
  supabaseMapRowsSchema,
  supabaseUserSchema,
  transcriptSchema,
  transformRequestSchema,
} from "./serverSchemas";

const map = {
  title: "Mapa de prueba",
  coreIdea: "Idea central",
  coreSupport: "Apoyo",
  tldr: [{ title: "Uno", desc: "Primero" }],
  steps: [{
    id: "step-1",
    shortNav: "Uno",
    title: "Primer paso",
    time: "~3 min",
    content: [{ type: "list", text: "Lista", items: [{ strong: "Uno" }] }],
  }],
};

describe("server input schemas", () => {
  it("accepts the APP_URL placeholder from the documented local setup", () => {
    expect(serverEnvSchema.parse({ APP_URL: "MY_APP_URL" }).APP_URL).toBe("MY_APP_URL");
  });

  it("parses typed environment overrides and rejects invalid numeric settings", () => {
    expect(serverEnvSchema.parse({ PORT: "8080", RATE_LIMIT_MAX: "12" })).toMatchObject({
      PORT: 8080, RATE_LIMIT_MAX: 12, MAX_UPLOAD_BYTES: 15 * 1024 * 1024,
    });
    expect(serverEnvSchema.safeParse({ PORT: "65536", RATE_LIMIT_WINDOW_MS: "no" }).success).toBe(false);
  });

  it("accepts transform inputs without coercing fields from JSON", () => {
    const upload = { type: "pdf", fileData: "cGRm", mimeType: "application/pdf", singleNucleoMode: true };
    expect(transformRequestSchema.parse(upload)).toEqual(upload);
    expect(transformRequestSchema.safeParse({ ...upload, singleNucleoMode: "false" }).success).toBe(false);
    expect(transformRequestSchema.safeParse({ type: "file" }).success).toBe(false);
  });

  it("validates nested maps and chat turns before using them", () => {
    expect(mapPayloadSchema.parse({ map })).toEqual({ map });
    expect(mapPayloadSchema.parse({})).toEqual({});
    expect(mapPayloadSchema.safeParse({ map: { ...map, tldr: [null] } }).success).toBe(false);
    expect(mapChatRequestSchema.parse({ map, question: " ¿Qué importa? " }).question).toBe("¿Qué importa?");
    expect(mapChatRequestSchema.safeParse({ question: "Pregunta", history: [null] }).success).toBe(false);
  });
});

describe("upstream response schemas", () => {
  it("accepts incomplete stream snapshots but rejects malformed nested fields", () => {
    const partial = { title: map.title, steps: [{ title: "Paso", content: [{ type: "list" }] }] };
    expect(generatedMapSchema.parse(partial)).toEqual(partial);
    expect(generatedMapSchema.safeParse({ steps: [{ content: [null] }] }).success).toBe(false);
    expect(geminiPdfAnalysisSchema.safeParse({ shouldProposeSplit: "false" }).success).toBe(false);
    expect(geminiChatSchema.safeParse({ followUps: [42] }).success).toBe(false);
  });

  it("recognizes SDK failures and validated Supabase and transcript responses", () => {
    const error = { error: { status: "RESOURCE_EXHAUSTED", code: 429 } };
    const sdkError = Object.assign(new Error(JSON.stringify(error)), { status: 429 });
    expect(sdkErrorSchema.parse(sdkError)).toEqual({ status: 429, message: sdkError.message });
    expect(geminiErrorSchema.parse(JSON.parse(sdkError.message))).toEqual(error);
    expect(supabaseUserSchema.safeParse({ id: 42 }).success).toBe(false);
    expect(supabaseMapRowsSchema.parse([{ session: { data: map } }])).toEqual([{ session: { data: map } }]);
    expect(transcriptSchema.safeParse([{ text: null }]).success).toBe(false);
  });
});
