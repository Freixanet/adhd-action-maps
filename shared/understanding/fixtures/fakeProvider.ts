/**
 * Deterministic fake UnderstandJsonGenerator for S04 tests.
 */

import type { UnderstandJsonGenerator } from '../../../server/src/understanding/runUnderstandEngine';
import {
  detectFixtureId,
  goldenBlueprint,
  goldenUnitsPayload,
  type GoldenFixtureId,
} from './goldenSources';

export type FakeProviderOptions = {
  /** Force invalid blueprint once, then valid (tests one repair). */
  failBlueprintOnce?: boolean;
  /** Always return invalid units (fail closed after repair). */
  alwaysInvalidUnits?: boolean;
  /** Return malformed units JSON once, then recover through the repair stage. */
  failUnitsOnce?: boolean;
  /** Inject hallucinated chunk id in units. */
  hallucinateChunk?: boolean;
  /** Delay ms per stage (budget / essential_ready timing tests). */
  delayMs?: number;
  model?: string;
};

export function createFakeUnderstandGenerateJson(
  opts: FakeProviderOptions = {}
): UnderstandJsonGenerator & { calls: Array<{ stage: string }> } {
  let blueprintFailsLeft = opts.failBlueprintOnce ? 1 : 0;
  let unitsFailsLeft = opts.failUnitsOnce ? 1 : 0;
  const calls: Array<{ stage: string }> = [];
  const model = opts.model ?? 'fake-s04-model';

  const gen: UnderstandJsonGenerator & { calls: typeof calls } = async ({ stage, user }) => {
    calls.push({ stage });
    if (opts.delayMs) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }

    const id = detectFixtureId(user) as GoldenFixtureId | null;
    if (!id || id === 'too_short') {
      return { text: '{}', model };
    }

    const isUnitsRepair =
      stage === 'repair' && /Reparación única de etapa units/i.test(user);
    const isBlueprintRepair =
      stage === 'repair' && /Reparación única de etapa blueprint/i.test(user);

    if (stage === 'blueprint' || isBlueprintRepair) {
      if (stage === 'blueprint' && blueprintFailsLeft > 0) {
        blueprintFailsLeft -= 1;
        return { text: JSON.stringify({ broken: true }), model };
      }
      return { text: JSON.stringify(goldenBlueprint(id)), model };
    }

    if (stage === 'units' || isUnitsRepair) {
      if (stage === 'units' && unitsFailsLeft > 0) {
        unitsFailsLeft -= 1;
        return { text: '{', model };
      }
      if (opts.alwaysInvalidUnits) {
        return { text: JSON.stringify({ units: [], closure: null }), model };
      }
      const chunkMatch = user.match(/chunk_id permitidos:\s*([^\n]+)/i);
      const chunkPart = chunkMatch?.[1]?.trim() ?? '';
      const chunkIds =
        !chunkPart || chunkPart.startsWith('(ninguno')
          ? []
          : chunkPart.split(',').map((s) => s.trim()).filter(Boolean);

      const payload = goldenUnitsPayload(id, chunkIds);
      if (opts.hallucinateChunk) {
        const units = (payload.units as Array<Record<string, unknown>>).map((u, i) =>
          i === 0
            ? {
                ...u,
                segmentRefs: [{ chunkId: 'hallucinated_chunk_xyz', status: 'pending' }],
              }
            : u
        );
        return { text: JSON.stringify({ units, closure: payload.closure }), model };
      }
      return { text: JSON.stringify(payload), model };
    }

    return { text: '{}', model };
  };

  gen.calls = calls;
  return gen;
}
