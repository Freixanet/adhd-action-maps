import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChapterMeta, IngestResult, SourceChunk } from "../../../shared/types/chunk";
import { chunkText, md5Short, rawHashOf, stripHtml } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

type EpubTocItem = { title?: string; href?: string; id?: string; level?: number };
type EpubFlowItem = { id: string; href?: string; title?: string };

type EpubInstance = {
  metadata?: { title?: string; cover?: string };
  toc?: EpubTocItem[];
  flow?: EpubFlowItem[];
  getChapter: (id: string, cb: (err: Error | null, text: string) => void) => void;
};

function getChapterAsync(epub: EpubInstance, id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapter(id, (err, text) => {
      if (err) reject(err);
      else resolve(text || "");
    });
  });
}

function resolveFlowId(flow: EpubFlowItem[], tocItem: EpubTocItem): string | null {
  if (tocItem.id && flow.some((f) => f.id === tocItem.id)) return tocItem.id;
  const href = (tocItem.href || "").split("#")[0];
  if (!href) return null;
  const match = flow.find((f) => (f.href || "").split("#")[0] === href);
  return match?.id ?? null;
}

/**
 * Hierarchical EPUB ingest: TOC → chapters → chunks 500/60 inside each chapter.
 */
export const epubIngestor: Ingestor = {
  canHandle(input) {
    const mime = (input.mime || "").toLowerCase();
    const ext = (input.ext || "").toLowerCase();
    return (
      mime === "application/epub+zip" ||
      mime === "application/epub" ||
      ext === "epub"
    );
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    if (!input.buffer?.length) {
      throw new Error("EPUB vacío.");
    }

    const dir = await mkdtemp(path.join(tmpdir(), "nucleo-epub-"));
    const filePath = path.join(dir, "book.epub");
    try {
      await writeFile(filePath, input.buffer);
      const epub2 = await import("epub2");
      const EPub =
        (epub2 as { EPub?: { createAsync: (p: string) => Promise<EpubInstance> } }).EPub ??
        (epub2 as { default?: { EPub?: { createAsync: (p: string) => Promise<EpubInstance> } } })
          .default?.EPub;
      if (!EPub?.createAsync) {
        throw new Error("epub2.createAsync no disponible.");
      }
      const epub = await EPub.createAsync(filePath);

      const flow = epub.flow || [];
      const toc = (epub.toc || []).filter((t) => (t.title || "").trim());

      const chapterSpecs: Array<{ title: string; id: string }> = [];
      if (toc.length) {
        for (const item of toc) {
          const id = resolveFlowId(flow, item);
          if (!id) continue;
          const title = (item.title || "Capítulo").trim();
          if (chapterSpecs.some((c) => c.id === id)) continue;
          chapterSpecs.push({ title, id });
        }
      }
      if (!chapterSpecs.length) {
        for (const item of flow) {
          chapterSpecs.push({
            title: (item.title || `Sección ${chapterSpecs.length + 1}`).trim(),
            id: item.id,
          });
        }
      }

      const allChunks: SourceChunk[] = [];
      const chapters: ChapterMeta[] = [];

      for (let chapterIndex = 0; chapterIndex < chapterSpecs.length; chapterIndex += 1) {
        const spec = chapterSpecs[chapterIndex]!;
        let html = "";
        try {
          html = await getChapterAsync(epub, spec.id);
        } catch {
          continue;
        }
        const chapterText = stripHtml(html);
        if (!chapterText) continue;

        const chapterChunks = chunkText(chapterText, {
          idPrefix: `epub:${chapterIndex}`,
          locFor: () => ({
            chapterTitle: spec.title,
            chapterIndex,
          }),
        }).map((chunk) => {
          const hash = md5Short(`${spec.title}${chunk.text}${chapterIndex}`);
          return {
            ...chunk,
            id: `chunk_${hash}`,
            hash,
            loc: {
              ...chunk.loc,
              chapterTitle: spec.title,
              chapterIndex,
            },
          };
        });

        if (!chapterChunks.length) continue;
        allChunks.push(...chapterChunks);
        chapters.push({
          title: spec.title,
          index: chapterIndex,
          chunkIds: chapterChunks.map((c) => c.id),
        });
      }

      if (!allChunks.length) {
        throw new Error("No se pudo extraer texto del EPUB.");
      }

      return {
        chunks: allChunks,
        chapters,
        metadata: {
          type: "epub",
          title: epub.metadata?.title || input.fileName?.replace(/\.epub$/i, "") || undefined,
          cover: epub.metadata?.cover || undefined,
        },
        rawHash: rawHashOf(input.buffer),
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
