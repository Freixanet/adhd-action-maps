/**
 * Post-generation citation attachment (ADR-002).
 * Filters hallucinated chunkIds, derives labels from real SourceChunks,
 * and attaches exact citedChunks for the mobile source viewer.
 */
import type { ActionMapData, SourceReference, StepContentBlock } from "../../shared/contracts";
import {
  citationHeaderFromLoc,
  citationLabelFromLoc,
} from "../../shared/citationLabels";
import {
  MAX_CITED_CHUNKS,
  type Citation,
  type IngestResult,
  type SourceChunk,
} from "../../shared/types/chunk";

export { citationHeaderFromLoc, citationLabelFromLoc } from "../../shared/citationLabels";

/** Markers the model must never echo into prose. */
const CHUNK_MARKER_RE = /\[\[chunk_[^\]]+\]\]/g;

function stripChunkMarkers(text: unknown): string {
  if (typeof text !== "string") return text == null ? "" : String(text);
  return text.replace(CHUNK_MARKER_RE, "").replace(/[ \t]+\n/g, "\n").trim();
}

function scrubBlock(block: StepContentBlock): StepContentBlock {
  if (!block || typeof block !== "object" || !("type" in block)) {
    return block;
  }
  switch (block.type) {
    case "prose":
    case "callout":
      return { ...block, text: stripChunkMarkers(block.text) };
    case "list":
      return {
        ...block,
        text: stripChunkMarkers(block.text),
        items: (Array.isArray(block.items) ? block.items : []).map((item) => ({
          ...item,
          strong: stripChunkMarkers(item?.strong),
          span: item?.span == null ? item?.span : stripChunkMarkers(item.span),
        })),
      };
    case "stat":
      return {
        ...block,
        value: stripChunkMarkers(block.value),
        label: stripChunkMarkers(block.label),
        source: block.source == null ? block.source : stripChunkMarkers(block.source),
      };
    case "comparison":
      return {
        ...block,
        columns: (Array.isArray(block.columns) ? block.columns : []).map(
          stripChunkMarkers
        ) as typeof block.columns,
        rows: (Array.isArray(block.rows) ? block.rows : []).map((row) => ({
          ...row,
          label: stripChunkMarkers(row?.label),
          values: (Array.isArray(row?.values) ? row.values : []).map(stripChunkMarkers),
        })),
      };
    case "accordion":
      return {
        ...block,
        title: stripChunkMarkers(block.title),
        body: stripChunkMarkers(block.body),
      };
    case "quiz":
      return {
        ...block,
        question: stripChunkMarkers(block.question),
        options: (Array.isArray(block.options) ? block.options : []).map(stripChunkMarkers),
        feedback: stripChunkMarkers(block.feedback),
      };
    default:
      return block;
  }
}

function scrubMapText(map: ActionMapData): ActionMapData {
  return {
    ...map,
    title: stripChunkMarkers(map.title),
    coreIdea: stripChunkMarkers(map.coreIdea),
    coreSupport: stripChunkMarkers(map.coreSupport),
    tldr: (Array.isArray(map.tldr) ? map.tldr : []).map((item) => ({
      title: stripChunkMarkers(item?.title),
      desc: stripChunkMarkers(item?.desc),
    })),
    knowledgeSections: map.knowledgeSections?.map((section) => ({
      ...section,
      title: stripChunkMarkers(section.title),
      summary: stripChunkMarkers(section.summary),
    })),
    steps: (Array.isArray(map.steps) ? map.steps : []).map((step) => ({
      ...step,
      shortNav: stripChunkMarkers(step.shortNav),
      title: stripChunkMarkers(step.title),
      purpose: step.purpose ? stripChunkMarkers(step.purpose) : step.purpose,
      content: (Array.isArray(step.content) ? step.content : []).map(scrubBlock),
      selfCheck: step.selfCheck ? stripChunkMarkers(step.selfCheck) : step.selfCheck,
    })),
    completionCard: map.completionCard
      ? {
          ...map.completionCard,
          title: stripChunkMarkers(map.completionCard.title),
          summary: stripChunkMarkers(map.completionCard.summary),
          takeaways: (Array.isArray(map.completionCard.takeaways)
            ? map.completionCard.takeaways
            : []
          ).map(stripChunkMarkers),
          promptQuestion: map.completionCard.promptQuestion
            ? stripChunkMarkers(map.completionCard.promptQuestion)
            : map.completionCard.promptQuestion,
        }
      : map.completionCard,
  };
}

type RefWalk = {
  ref: SourceReference;
  path: string;
};

function collectReferences(map: ActionMapData): RefWalk[] {
  const out: RefWalk[] = [];
  for (const [i, ref] of (map.references ?? []).entries()) {
    out.push({ ref, path: `references[${i}]` });
  }
  for (const [si, step] of map.steps.entries()) {
    for (const [ri, ref] of (step.references ?? []).entries()) {
      out.push({ ref, path: `steps[${si}].references[${ri}]` });
    }
    for (const [bi, block] of step.content.entries()) {
      const refs = "references" in block ? block.references : undefined;
      if (!refs) continue;
      for (const [ri, ref] of refs.entries()) {
        out.push({ ref, path: `steps[${si}].content[${bi}].references[${ri}]` });
      }
    }
  }
  for (const [ki, section] of (map.knowledgeSections ?? []).entries()) {
    for (const [ri, ref] of (section.references ?? []).entries()) {
      out.push({ ref, path: `knowledgeSections[${ki}].references[${ri}]` });
    }
  }
  return out;
}

function rewriteReferences(
  map: ActionMapData,
  rewrite: (ref: SourceReference) => SourceReference
): ActionMapData {
  const mapRefs = (map.references ?? []).map(rewrite);
  const steps = map.steps.map((step) => ({
    ...step,
    references: (step.references ?? []).map(rewrite),
    content: step.content.map((block) => {
      if (!("references" in block) || !block.references) return block;
      return { ...block, references: block.references.map(rewrite) };
    }),
  }));
  const knowledgeSections = map.knowledgeSections?.map((section) => ({
    ...section,
    references: (section.references ?? []).map(rewrite),
  }));
  return {
    ...map,
    references: mapRefs.length ? mapRefs : map.references,
    steps,
    knowledgeSections,
  };
}

/**
 * Attach verified citations to a normalized map.
 * When `ingest` is null (passthrough / no factory), strips chunkIds and returns
 * the map without citations.
 */
export function attachCitations(
  map: ActionMapData,
  ingest: IngestResult | null | undefined
): ActionMapData {
  try {
    return attachCitationsUnsafe(map, ingest);
  } catch (err) {
    // Never kill the HTTP response over citation post-processing.
    console.error(
      "[citations] attachCitations failed; returning map without citations:",
      err instanceof Error ? err.message : err
    );
    return map;
  }
}

function attachCitationsUnsafe(
  map: ActionMapData,
  ingest: IngestResult | null | undefined
): ActionMapData {
  const scrubbed = scrubMapText(map);

  if (!ingest?.chunks?.length) {
    return rewriteReferences(scrubbed, (ref) => {
      if (!ref.chunkId) return ref;
      const { chunkId: _drop, ...rest } = ref;
      return rest;
    });
  }

  const chunkMap = new Map(ingest.chunks.map((c) => [c.id, c]));
  let dropped = 0;
  const citedOrder: string[] = [];
  const seen = new Set<string>();
  const citations: Citation[] = [];

  const walk = collectReferences(scrubbed);
  for (const { ref } of walk) {
    const id = ref.chunkId?.trim();
    if (!id) continue;
    const chunk = chunkMap.get(id);
    if (!chunk) {
      dropped += 1;
      continue;
    }
    if (seen.has(id)) continue;
    if (citedOrder.length >= MAX_CITED_CHUNKS) continue;
    seen.add(id);
    citedOrder.push(id);
    citations.push({
      id: `cite_${id}`,
      chunkId: id,
      loc: chunk.loc,
      label: citationLabelFromLoc(chunk.loc),
    });
  }

  if (dropped > 0) {
    console.warn(`[citations] dropped ${dropped} hallucinated chunkId(s)`);
  }

  const citedChunks: SourceChunk[] = citedOrder
    .map((id) => chunkMap.get(id))
    .filter((c): c is SourceChunk => Boolean(c));

  const withLabels = rewriteReferences(scrubbed, (ref) => {
    const id = ref.chunkId?.trim();
    if (!id) return ref;
    const chunk = chunkMap.get(id);
    if (!chunk || !seen.has(id)) {
      const { chunkId: _drop, ...rest } = ref;
      return rest;
    }
    const label = citationLabelFromLoc(chunk.loc);
    return {
      ...ref,
      chunkId: id,
      label,
      locator: citationHeaderFromLoc(chunk.loc),
    };
  });

  return {
    ...withLabels,
    citations: citations.length ? citations : undefined,
    citedChunks: citedChunks.length ? citedChunks : undefined,
  };
}
