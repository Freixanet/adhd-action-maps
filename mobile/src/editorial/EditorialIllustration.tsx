import React from 'react';
import type { VisualComposition, VisualIntent, VisualRole } from '@shared/editorial/visualLibrary';
import { EditorialHeroComposition } from './visuals/EditorialComposition';

type Props = {
  intent: VisualIntent;
  role: VisualRole;
  composition?: VisualComposition;
  width: number;
  usedIds?: readonly string[];
  queryTags?: readonly string[];
  /** @deprecated Ignored — no remote illustration fetches. */
  streamlineSpec?: unknown;
  /** @deprecated Ignored — no remote illustration fetches. */
  resolved?: unknown;
  onResolvedDev?: (info: { assetId: string; provider: string; localModule: string }) => void;
};

/**
 * Thin entry: semantic selection → local professional SVG.
 * No Streamline, no hand-drawn scenes, no provider names in the paint path.
 * Reload marker: local-bro-v1-fix-includes-2026-08-01
 */
export default function EditorialIllustration({
  intent,
  width,
  queryTags,
  onResolvedDev,
}: Props) {
  return (
    <EditorialHeroComposition
      intent={intent}
      width={width}
      queryTags={queryTags}
      onResolvedDev={onResolvedDev}
    />
  );
}
