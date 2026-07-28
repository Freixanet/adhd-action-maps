import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attachCitations,
  citationHeaderFromLoc,
  citationLabelFromLoc,
} from "./citations";
import type { ActionMapData } from "../../shared/contracts";
import type { IngestResult, SourceChunk } from "../../shared/types/chunk";

function makeChunk(
  id: string,
  text: string,
  loc: SourceChunk["loc"]
): SourceChunk {
  return { id, text, loc, hash: id.replace("chunk_", "") };
}

function baseMap(overrides?: Partial<ActionMapData>): ActionMapData {
  return {
    title: "Mapa de prueba",
    coreIdea: "Idea",
    coreSupport: "Apoyo",
    tldr: [{ title: "Uno", desc: "Desc" }],
    steps: [
      {
        id: "step-1",
        shortNav: "1",
        title: "Paso 1",
        time: "~2 min",
        content: [
          {
            type: "prose",
            text: "El TDAH afecta la atención. [[chunk_leaked]]",
            references: [
              {
                label: "hallucinated",
                locator: "x",
                chunkId: "chunk_fake",
                excerpt: "modelo inventó esto",
              },
              {
                label: "ok",
                locator: "y",
                chunkId: "chunk_real1",
                excerpt: "cita del modelo",
              },
            ],
          },
        ],
        references: [
          {
            label: "dup",
            locator: "z",
            chunkId: "chunk_real1",
          },
        ],
      },
    ],
    references: [
      {
        label: "page",
        locator: "p",
        chunkId: "chunk_page",
      },
    ],
    ...overrides,
  };
}

describe("citationLabelFromLoc", () => {
  it("prefers page, then chapter, then image, else Fuente", () => {
    expect(citationLabelFromLoc({ page: 23, start: 0, end: 1 })).toBe("p.23");
    expect(
      citationLabelFromLoc({
        chapterIndex: 1,
        chapterTitle: "Intro",
        start: 0,
        end: 1,
      })
    ).toBe("Cap. 2");
    expect(citationLabelFromLoc({ imageId: "img1", start: 0, end: 1 })).toBe("Foto");
    expect(citationLabelFromLoc({ start: 0, end: 1 })).toBe("Fuente");
  });

  it("builds a longer viewer header for chapters", () => {
    expect(
      citationHeaderFromLoc({
        chapterIndex: 1,
        chapterTitle: "Intro",
        start: 0,
        end: 1,
      })
    ).toBe("Cap. 2 · Intro");
  });
});

describe("attachCitations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters hallucinated chunkIds without crashing and keeps exact source text", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ingest: IngestResult = {
      chunks: [
        makeChunk("chunk_real1", "TEXTO EXACTO DEL CHUNK", {
          chapterIndex: 0,
          chapterTitle: "Inicio",
          start: 0,
          end: 22,
        }),
        makeChunk("chunk_page", "página dos", { page: 2, start: 0, end: 10 }),
      ],
      metadata: { type: "pdf" },
      rawHash: "abc",
    };

    const result = attachCitations(baseMap(), ingest);

    expect(result.citations?.map((c) => c.chunkId)).toEqual([
      "chunk_page",
      "chunk_real1",
    ]);
    expect(result.citations?.[0]?.label).toBe("p.2");
    expect(result.citations?.[1]?.label).toBe("Cap. 1");
    expect(result.citedChunks?.map((c) => c.id)).toEqual([
      "chunk_page",
      "chunk_real1",
    ]);
    expect(result.citedChunks?.[1]?.text).toBe("TEXTO EXACTO DEL CHUNK");
    expect(result.citedChunks?.[1]?.text).not.toContain("cita del modelo");

    const prose = result.steps[0]!.content[0]!;
    expect(prose.type).toBe("prose");
    if (prose.type === "prose") {
      expect(prose.text).not.toContain("[[chunk_");
      expect(prose.references?.some((r) => r.chunkId === "chunk_fake")).toBe(false);
      expect(prose.references?.some((r) => r.chunkId === "chunk_real1")).toBe(true);
      const real = prose.references?.find((r) => r.chunkId === "chunk_real1");
      expect(real?.label).toBe("Cap. 1");
    }

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[citations] dropped 1 hallucinated")
    );
  });

  it("strips chunkIds and produces no citations when ingest is missing (passthrough)", () => {
    const result = attachCitations(baseMap(), null);
    expect(result.citations).toBeUndefined();
    expect(result.citedChunks).toBeUndefined();
    const prose = result.steps[0]!.content[0]!;
    if (prose.type === "prose") {
      expect(prose.references?.every((r) => !r.chunkId)).toBe(true);
    }
  });

  it("does not crash when scrubbing blocks with missing fields", () => {
    const map = baseMap({
      steps: [
        {
          id: "step-1",
          shortNav: "1",
          title: "Paso",
          time: "~2 min",
          content: [
            { type: "comparison", left: undefined as unknown as string, right: "b" } as never,
            { type: "quiz", question: "q", options: undefined as unknown as string[], feedback: "f", correct: 0 } as never,
            { type: "list", items: undefined as unknown as [] } as never,
            { type: "accordion", items: undefined as unknown as [] } as never,
          ],
        },
      ],
      references: [],
    });

    expect(() => attachCitations(map, null)).not.toThrow();
    const result = attachCitations(map, null);
    expect(result.steps[0]?.content.length).toBe(4);
  });
});
