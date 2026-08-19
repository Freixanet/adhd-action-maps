/**
 * Persist S05 evidence graph with user JWT (no service role).
 * Re-export shared productive persister for server callers.
 */

export {
  persistEvidenceWithUserJwt,
  type PersistEvidenceArgs,
  type PersistEvidenceResult,
} from '../../../shared/evidence/persistEvidence';
