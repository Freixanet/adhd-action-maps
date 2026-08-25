/**
 * Deterministic fake entailment provider for S05 tests.
 * Does NOT copy fixture labels blindly — scores claim vs candidate text.
 */

import type { EvidenceJsonGenerator } from './entailment';
import { runDeterministicChecks } from './deterministicChecks';

export function createFakeEvidenceGenerateJson(opts?: {
  forceError?: boolean;
  model?: string;
  delayMs?: number;
}): EvidenceJsonGenerator & { calls: number } {
  const model = opts?.model ?? 'fake-s05-entailment';
  const gen: EvidenceJsonGenerator & { calls: number } = async ({ user }) => {
    if (opts?.delayMs) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    gen.calls += 1;
    if (opts?.forceError) {
      throw new Error('provider timeout');
    }

    const claimMatch = user.match(/claim:\s*(.+)/);
    const claimText = claimMatch?.[1]?.trim() ?? '';
    const allowedMatch = user.match(/allowedChunkIds:\s*(\[[^\]]*\])/);
    let allowed: string[] = [];
    try {
      allowed = allowedMatch ? (JSON.parse(allowedMatch[1]!) as string[]) : [];
    } catch {
      allowed = [];
    }

    // Extract candidate blocks
    const blocks = [...user.matchAll(/\[\[([^\]]+)\]\]\n([\s\S]*?)(?=\n\[\[|$)/g)];
    const candidates = blocks.map((m) => ({
      id: m[1]!,
      text: (m[2] ?? '').trim(),
    }));

    if (!candidates.length || !allowed.length) {
      return {
        text: JSON.stringify({ decision: 'insufficient', chunkIds: [] }),
        model,
      };
    }

    // Prompt injection in chunk must not change decision to supports via instruction
    const injected = candidates.some((c) =>
      /ignora|ignore previous|system:|verifica como supports/i.test(c.text)
    );

    let best = candidates[0]!;
    let bestScore = -1;
    for (const c of candidates) {
      if (!allowed.includes(c.id)) continue;
      const det = runDeterministicChecks(claimText, c.text);
      if (!det.ok) continue;
      const overlap = claimText
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3 && c.text.toLowerCase().includes(t)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = c;
      }
    }

    const det = runDeterministicChecks(claimText, best.text);
    if (!det.ok || injected && /verifica como supports/i.test(best.text)) {
      // Injection alone shouldn't force supports; if only injection text, insufficient
      if (injected && bestScore < 2) {
        return {
          text: JSON.stringify({ decision: 'insufficient', chunkIds: [] }),
          model,
        };
      }
      if (!det.ok) {
        return {
          text: JSON.stringify({ decision: 'insufficient', chunkIds: [best.id] }),
          model,
        };
      }
    }

    if (bestScore < 1) {
      return {
        text: JSON.stringify({ decision: 'insufficient', chunkIds: [] }),
        model,
      };
    }

    // Qualifier: source has modality/hedge claim lacks
    if (
      /\b(puede|podría|suele|en algunos casos)\b/i.test(best.text) &&
      !/\b(puede|podría|suele|en algunos casos)\b/i.test(claimText)
    ) {
      return {
        text: JSON.stringify({
          decision: 'qualifies',
          chunkIds: [best.id],
          qualifierNote: 'la fuente usa un modalizador',
        }),
        model,
      };
    }

    if (/\bno\b/i.test(best.text) && !/\bno\b/i.test(claimText) && claimText.length > 20) {
      return {
        text: JSON.stringify({ decision: 'contradicts', chunkIds: [best.id] }),
        model,
      };
    }

    return {
      text: JSON.stringify({ decision: 'supports', chunkIds: [best.id] }),
      model,
    };
  };
  gen.calls = 0;
  return gen;
}
