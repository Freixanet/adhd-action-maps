import {
  ASK_TEXT_MAX_CHARS,
  type AskIngestResult,
} from "../../../shared/types/chunk";
import type { TransformRequest } from "../../../shared/contracts";

const ASK_STARTERS =
  /^(qué|que|cómo|como|cuál|cual|cuáles|cuales|por qué|porque|por que|quién|quien|dónde|donde|cuándo|cuando|what|why|how|who|where|when)\b/i;

/**
 * Dual-lane router (ADR-002 / S03).
 * Explicit `textMode: 'source'` never becomes ASK — even for short questions.
 * Explicit `textMode: 'ask'` always becomes ASK for plain text.
 * Legacy bodies without textMode keep the heuristic.
 */
export function isAskLaneInput(body: TransformRequest): boolean {
  if (body.fileData) return false;
  if (body.type === "link" || body.type === "youtube" || body.type === "pdf") return false;
  if (body.type === "image" || body.type === "video") return false;

  if (body.textMode === "source") return false;
  if (body.textMode === "ask") {
    const askText = (body.text || "").trim();
    return Boolean(askText);
  }

  const text = (body.text || "").trim();
  if (!text || text.length >= ASK_TEXT_MAX_CHARS) return false;

  try {
    const asUrl = new URL(text);
    if (asUrl.protocol === "http:" || asUrl.protocol === "https:") return false;
  } catch {
    // not a URL
  }

  if (text.endsWith("?")) return true;
  if (ASK_STARTERS.test(text)) return true;
  return false;
}

export function askResultShell(answer: string): AskIngestResult {
  return {
    isAsk: true,
    answer,
    disclaimer: "Conocimiento general, sin fuente verificada",
    cta: {
      label: "Añadir fuente para verificar",
      action: "attach_source",
    },
  };
}
