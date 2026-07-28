# ADR-002: Ingestion Factory
Fecha: 2026-07-27
Estado: Spec de arquitectura aprobado
Riesgo si no se hace: Núcleos sin citas verificables, libros planos ilegibles para TDAH, alucinaciones en fotos, coste LLM descontrolado

# Núcleo IngestorFactory — Architecture Spec

## Goal

Convert **any** input into a canonical intermediate: `SourceChunk[]` with **verifiable citations**, plus optional hierarchy metadata. Downstream Núcleo generation must only assert what a chunk can prove.

Two lanes:
| Lane | Purpose | Citation |
|------|---------|----------|
| **SOURCE** | Grounded transformation | Every claim → `chunkId` (+ loc) |
| **ASK** | Short free questions | No chunks; explicit “unverified” disclaimer |

---

## Why hierarchical books beat flat 80k-word chunking

Flat chunking a whole book (fixed windows across the full text) fails ADHD product quality and cost:

1. **Lost structure** — Chapter boundaries vanish. A Núcleo mixes Act 1 and Act 12; the reader cannot map “Paso 3” to “Capítulo: X”.
2. **Attention tax** — ADHD UX needs finishable units. Flat bags produce one endless map or random mid-book jumps.
3. **Retrieval pollution** — Top-k over 80k words pulls similar-but-wrong paragraphs from distant chapters.
4. **Cost** — Embedding/summarizing all chunks of a novel is O(n). An **overview Núcleo** only needs ~one seed per chapter (first/representative chunk), then deep-dive Núcleos per chapter later.
5. **Citation honesty** — Loc must be `{chapterTitle, chapterIndex, …}`. Flat offsets cannot name the chapter the user is holding.

**Rule:** Parse TOC → chapters → chunk *inside* chapter. Never cross chapter boundaries in a single chunk.

---

## Why images need OCR + vision (hybrid)

| Mode | What it gets right | What it breaks |
|------|--------------------|----------------|
| **Vision-only** | Layout, diagrams, “what this slide is about” | Invents numbers, misreads handwriting, paraphrases as fact → **uncitable** |
| **OCR-only** | Verbatim glyphs | Misses arrows/formulas-as-drawing, board structure; chunks feel like noise |

**Hybrid:**
- **Layer A (citable):** OCR text = `chunk.text`. Citations quote this only.
- **Layer B (structural, not citable):** Gemini vision caption/diagram parse → feeds outline, callout kinds, step grouping. Stored as `assist.caption` / `assist.structure`, **never** as citation locus.

Loc: `{ imageId: hash(bytes), bbox?: {x,y,w,h} }` for future highlight overlays.

---

## TypeScript interfaces

```ts
/** Stable id: hash(sourceId + chapterIndex? + ordinal + contentHash) */
type ChunkId = string;

type BBox = { x: number; y: number; w: number; h: number }; // normalized 0–1 preferred

type SourceLoc =
  | { kind: 'book'; chapterTitle: string; chapterIndex: number; pageIndex?: number; charStart: number; charEnd: number }
  | { kind: 'pdf'; pageIndex: number; charStart?: number; charEnd?: number }
  | { kind: 'docx' | 'txt' | 'md'; charStart: number; charEnd: number; headingPath?: string[] }
  | { kind: 'url'; url: string; canonicalUrl?: string; paragraphIndex?: number }
  | { kind: 'youtube'; videoId: string; startSec?: number; endSec?: number }
  | { kind: 'image'; imageId: string; bbox?: BBox; ocrBlockIndex?: number };

type ChunkRole = 'verbatim' | 'assist'; // assist = Layer B, not for citation validator

interface SourceChunk {
  id: ChunkId;
  text: string;                 // Layer A: citable; for images = OCR only
  loc: SourceLoc;
  role: ChunkRole;              // default 'verbatim'
  assist?: {                    // Layer B only; omit for pure text
    caption?: string;
    structureNotes?: string;
  };
  contentHash: string;          // of citable text
  tokenEstimate?: number;
}

interface ChapterMeta {
  title: string;
  index: number;                // 0-based TOC order
  startIndex: number;           // char offset in linear book text (or spine index)
  chunkIds: ChunkId[];          // chunks wholly inside this chapter
}

interface IngestResultSource {
  lane: 'source';
  sourceId: string;
  sourceKind: 'epub' | 'pdf' | 'docx' | 'txt' | 'md' | 'url' | 'youtube' | 'image';
  title?: string;
  chunks: SourceChunk[];        // role:'verbatim' only enter citation validator
  chapters?: ChapterMeta[];     // required for epub (and PDF with outline when available)
  warnings?: string[];          // e.g. "TOC missing; synthetic chapters by size"
}

interface IngestResultAsk {
  lane: 'ask';
  isAsk: true;
  question: string;
  answer: string;
  disclaimer: 'Conocimiento general, sin fuente verificada';
  cta: { label: 'Añadir fuente para verificar'; action: 'attach_source' };
  // no chunks — must never hit chunk validator
}

type IngestResult = IngestResultSource | IngestResultAsk;

interface IngestInput {
  text?: string;
  files?: Array<{ name: string; mimeType: string; bytes: Uint8Array }>;
  url?: string;                 // only after secureFetcher
  youtubeUrl?: string;
  images?: Array<{ bytes: Uint8Array; mimeType: string }>;
}

interface Ingestor {
  readonly kind: IngestResultSource['sourceKind'] | 'ask';
  canHandle(input: IngestInput): boolean;
  ingest(input: IngestInput): Promise<IngestResult>;
}
```

**Book chunking constants:** `size=500` chars, `overlap=60`, never span chapters.  
**Overview seed set:** `chapters.map(c => chunks[c.chunkIds[0]])` (or best representative), not the full bag.

---

## Factory: `getIngestor(input)` (pseudocode)

```
function getIngestor(input): Ingestor {
  if (isAskLane(input)) return AskIngestor

  if (input.youtubeUrl || isYouTube(input.url)) return YouTubeIngestor
  if (input.url) return UrlIngestor          // secureFetcher → text → chunk
  if (hasFile(input, '.epub'|'application/epub+zip')) return EpubIngestor
  if (hasFile(input, pdf)) return PdfIngestor
  if (hasFile(input, docx)) return DocxIngestor
  if (hasFile(input, txt|md)) return PlainTextIngestor
  if (input.images?.length || isImageMime(files)) return ImageHybridIngestor

  if (input.text?.trim()) return PlainTextIngestor   // long paste as source
  throw UnsupportedInputError
}

function ingest(input): IngestResult {
  return getIngestor(input).ingest(input)
}
```

**Pipeline after SOURCE ingest (not ASK):**
1. Drop or quarantine `role:'assist'` from citation set.
2. Chunk validator: non-empty, max size, loc present, contentHash stable.
3. Optional embed index keyed by `chunkId` + `chapterIndex`.
4. Transform prompt may use assist captions as *scaffolding only*, with system rule: “Never quote assist; cite only verbatim chunks.”

---

## Decision table: ASK vs SOURCE

| Signal | ASK | SOURCE |
|--------|-----|--------|
| File / image / URL / YouTube present | ❌ | ✅ |
| `text.length < 200` AND ends with `?` AND no attachment | ✅ | ❌ |
| `text.length < 200`, no `?`, no attachment | Prefer SOURCE if looks like title/paste; else ASK only if interrogative (¿…? / how/what/why…) | Default SOURCE for ambiguous short paste |
| `text.length ≥ 200` | ❌ | ✅ |
| Explicit user mode “Preguntar” (future UI) | ✅ | — |
| Explicit “Transformar fuente” | — | ✅ |

**Hard rule:** ASK results **bypass** chunk validator and must not invent `SourceChunk[]`.

---

## Ingestor behaviors (summary)

### EpubIngestor
1. Unpack spine + TOC (`nav` / NCX).
2. Build `ChapterMeta[]` `{title, startIndex}`.
3. Extract plain text per chapter (strip scripts/nav chrome).
4. Chunk 500 / overlap 60 **within chapter**; `loc.kind='book'`.
5. Return `{ chunks, chapters: [{ title, chunkIds }] }`.
6. If TOC missing: warn + synthetic chapters by size (~3–5k chars) still hierarchical.

### Pdf / Docx / Txt / Md
- PDF: page-aware loc; outline → chapters when present, else flat with `pageIndex`.
- Docx/Md: optional `headingPath` from styles/ATX headings.
- Same size/overlap; no false book hierarchy without evidence.

### Url / YouTube
- Existing secure fetch / transcript → chunks with `url` / `youtube` loc (time ranges when available).

### ImageHybridIngestor
1. `imageId = hash(bytes)`.
2. OCR → one or more verbatim chunks (block-level if bbox available).
3. Vision caption → `assist` on primary chunk or sibling `role:'assist'` chunk excluded from validator.
4. Multi-image: ordered by input index; no cross-image merging of OCR text.

### AskIngestor
1. Confirm `isAskLane`.
2. Call existing `/api/ask` (or shared ask service).
3. Return `IngestResultAsk` only.

---

## Three failure modes (and avoidance)

| # | Failure | Symptom | Avoid |
|---|---------|---------|--------|
| **1** | **Citation laundering** | Núcleo quotes vision caption / model paraphrase as if from source | Split `role`; validator only sees OCR/text; prompts forbid citing `assist`; UI citations resolve only `verbatim` ids |
| **2** | **Chapter bleed** | Chunks span TOC boundaries; overview mixes unrelated parts | Chunk strictly inside chapter windows; reject spans in validator; overview = first chunk per chapter only |
| **3** | **Ask disguised as source** | Short “¿Qué es X?” becomes a fake Núcleo with invented “fuente” | Router table before any ingestor; ASK never emits chunks; product CTA to attach source for verify |

**Secondary watchouts:** empty OCR on photo → fail closed with “No se pudo leer texto; prueba mejor luz” (don’t fall back to vision-as-text). Huge epub without TOC → synthetic chapters + warning, not one 80k blob.

---

## Downstream hooks (for later, not this factory)

- **Overview Núcleo:** summarize from `{chapterTitle + firstChunk.text}` × N chapters.
- **Chapter Núcleo:** full `chunkIds` of one `ChapterMeta`.
- **Verify UI:** highlight `loc` (page/bbox/time) from cited `chunkId`.

---

## Non-goals (v1 of this factory)

- Full StudyDoc graph, Live Activity, CSV.
- Making ASK answers citable without a user-supplied source.
- Replacing `secureFetcher` (URL stays behind existing SSRF ADR).
