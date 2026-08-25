/**
 * Stable unit identity — model never controls persisted IDs.
 * Seed includes structural versions so prompt/schema/compiler bumps namespace IDs.
 */

import { sha256Hex } from '../sha256Hex';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_MODEL_ROUTE,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from './versions';

export type UnitIdentitySeedArgs = {
  contentHash: string;
  sourceVersionId?: string;
  schemaVersion?: string;
  promptVersion?: string;
  compilerVersion?: string;
  depth: string;
};

/** Deterministic structural seed for unit ID namespace. */
export function buildUnitIdentitySeed(args: UnitIdentitySeedArgs): string {
  return sha256Hex(
    [
      args.contentHash,
      args.sourceVersionId ?? '',
      args.schemaVersion ?? UNDERSTANDING_SCHEMA_VERSION,
      args.promptVersion ?? UNDERSTANDING_PROMPT_VERSION,
      args.compilerVersion ?? UNDERSTANDING_COMPILER_VERSION,
      args.depth,
    ].join('|')
  ).slice(0, 24);
}

/**
 * Slot key: prefer plan unitOrder index, else index + local id.
 * Avoid coupling IDs to free-form model titles so prose tweaks don't churn IDs.
 */
export function unitSlotKey(args: {
  index: number;
  planUnitOrder?: string[];
  localId: string;
}): string {
  if (args.planUnitOrder && args.planUnitOrder[args.index]) {
    return `slot:${args.index}|${args.planUnitOrder[args.index]!.trim().toLowerCase()}`;
  }
  return `slot:${args.index}|${args.localId.trim().toLowerCase()}`;
}

export function stableUnderstandingId(seed: string, slotKey: string, index: number): string {
  const h = sha256Hex(`${seed}|${slotKey}|${index}`).slice(0, 12);
  return `u_${h}`;
}

export type UnderstandingCacheKeyArgs = {
  ownerId: string;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  intent: string;
  depth: string;
  schemaVersion?: string;
  promptVersion?: string;
  compilerVersion?: string;
  modelRoute?: string;
};

export function understandingCacheKey(args: UnderstandingCacheKeyArgs): string {
  return sha256Hex(
    [
      args.ownerId,
      args.contentHash,
      args.sourceId ?? '',
      args.sourceVersionId ?? '',
      args.intent,
      args.depth,
      args.schemaVersion ?? UNDERSTANDING_SCHEMA_VERSION,
      args.promptVersion ?? UNDERSTANDING_PROMPT_VERSION,
      args.compilerVersion ?? UNDERSTANDING_COMPILER_VERSION,
      args.modelRoute ?? UNDERSTANDING_MODEL_ROUTE,
    ].join('|')
  );
}
