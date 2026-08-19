/**
 * Replan with new context using the same evidence artifact (no S04/S05 regen).
 */

import type { ActionMapData, TransformRequest } from '../contracts';
import type { EvidenceArtifact } from '../evidence/types';
import { runApplicationEngine, type RunApplicationEngineArgs } from './runApplicationEngine';
import type { ApplicationArtifactV1, ApplicationContextV1 } from './types';

export type ReplanApplicationArgs = {
  previous: ApplicationArtifactV1;
  baseMap: ActionMapData;
  evidence: EvidenceArtifact;
  context: ApplicationContextV1;
  body?: Partial<TransformRequest>;
  ownerId?: string;
  generateJson?: RunApplicationEngineArgs['generateJson'];
  buildPlanPrompts?: RunApplicationEngineArgs['buildPlanPrompts'];
  buildRepairPrompt?: RunApplicationEngineArgs['buildRepairPrompt'];
  isCancelled?: () => boolean;
  /**
   * When false (default), replace active plan identity via new context hash.
   * Explicit versioning would keep previous — not implemented as silent keep.
   */
  keepPreviousAsVersion?: boolean;
};

/**
 * Rebuild application plan from the same source/evidence with updated context.
 * Does not re-run understanding or evidence engines.
 */
export async function replanApplicationFromEvidence(args: ReplanApplicationArgs) {
  const body: TransformRequest = {
    type: 'text',
    intent: 'apply',
    depth: (args.previous.depth as TransformRequest['depth']) || 'estandar',
    sourceId: args.previous.sourceId,
    sourceVersionId: args.previous.sourceVersionId,
    applicationContext: args.context,
    ...(args.body ?? {}),
  };

  const result = await runApplicationEngine({
    body,
    map: args.baseMap,
    evidence: args.evidence,
    contentHash: args.previous.contentHash,
    context: args.context,
    ownerId: args.ownerId,
    understandingVersions: {
      schemaVersion: args.previous.understandingSchemaVersion,
      promptVersion: args.previous.understandingPromptVersion,
      compilerVersion: args.previous.understandingCompilerVersion,
    },
    generateJson: args.generateJson,
    buildPlanPrompts: args.buildPlanPrompts,
    buildRepairPrompt: args.buildRepairPrompt,
    isCancelled: args.isCancelled,
  });

  if (result.ok === false) return result;

  // New context → new digest/identity. Previous plan is discarded unless explicit versioning.
  if (args.keepPreviousAsVersion) {
    // Explicit versioning hook — caller must persist previous separately.
    return { ...result, previousPreserved: true as const };
  }
  return { ...result, previousPreserved: false as const };
}
