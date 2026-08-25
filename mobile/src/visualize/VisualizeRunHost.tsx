import React from 'react';
import type { PersistedVisualizationRun } from '@shared/visualize';
import VisualizeRendererRegistry from './rendererRegistry';

type Props = {
  run: PersistedVisualizationRun;
};

/** Host for visualizeRun v2 — RN only, no WebView HTML from the model. */
export default function VisualizeRunHost({ run }: Props) {
  return <VisualizeRendererRegistry spec={run.renderSpec} />;
}
