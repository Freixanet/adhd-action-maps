/**
 * Honest SourceCoverage + EvidenceCoverage builders.
 */

import type { IngestResult } from '../types/chunk';
import type {
  ContentClaim,
  EvidenceCoverage,
  SourceCoverageHonest,
} from './types';

export function buildSourceCoverage(args: {
  ingest: IngestResult | null;
  /** Pasted canonical text fully available. */
  pastedComplete?: boolean;
  partialExtraction?: boolean;
  webFetchSucceeded?: boolean;
}): SourceCoverageHonest {
  const limitations: SourceCoverageHonest['limitations'] = [];

  if (args.partialExtraction) {
    limitations.push({
      code: 'PARTIAL_EXTRACTION',
      detail: 'Parte del documento no pudo extraerse.',
    });
  }
  if (args.webFetchSucceeded) {
    limitations.push({
      code: 'WEB_FETCH_UNKNOWN_COMPLETENESS',
      detail: 'Un fetch exitoso no demuestra ausencia de paywall u omisiones.',
    });
  }
  if (args.ingest?.needsVisionFallback) {
    limitations.push({
      code: 'VISION_FALLBACK',
      detail: 'Sin texto citable recuperado; se requirió ruta multimodal.',
    });
  }

  let isComplete: boolean | null = null;
  if (args.pastedComplete === true && !args.partialExtraction) {
    isComplete = true;
  } else if (args.partialExtraction) {
    isComplete = false;
  } else if (args.webFetchSucceeded) {
    isComplete = null;
  }

  return {
    textual: null,
    extractionConfidence: null,
    isComplete,
    limitations,
  };
}

export function buildEvidenceCoverage(claims: ContentClaim[]): EvidenceCoverage {
  const critical = claims.filter((c) => c.criticality === 'critical');
  const count = (status: ContentClaim['presentationStatus']) =>
    critical.filter((c) => c.presentationStatus === status).length;

  const verified = count('verified');
  const qualified = count('qualified');
  const contradicted = count('contradicted');
  const degraded = count('degraded');
  const inference = count('inference');
  const insufficient = count('insufficient');
  const pending = count('pending');
  const unanchored = critical.filter((c) =>
    c.abstentionCodes.includes('NO_ANCHOR')
  ).length;

  const summaryLines: string[] = [];
  if (verified) summaryLines.push(`${verified} idea${verified === 1 ? '' : 's'} respaldada${verified === 1 ? '' : 's'}`);
  if (qualified) {
    summaryLines.push(
      `${qualified} conclusión${qualified === 1 ? '' : 'es'} con matices`
    );
  }
  if (contradicted) {
    summaryLines.push(
      `${contradicted} punto${contradicted === 1 ? '' : 's'} con contradicción`
    );
  }
  if (insufficient + unanchored) {
    const n = Math.max(insufficient, unanchored);
    summaryLines.push(
      `${n} punto${n === 1 ? '' : 's'} no determinable${n === 1 ? '' : 's'}`
    );
  }
  if (inference) {
    summaryLines.push(
      `${inference} inferencia${inference === 1 ? '' : 's'} de Núcleo`
    );
  }
  if (degraded) {
    summaryLines.push(
      `${degraded} afirmación${degraded === 1 ? '' : 'es'} degradada${degraded === 1 ? '' : 's'}`
    );
  }

  return {
    criticalTotal: critical.length,
    verified,
    qualified,
    contradicted,
    degraded,
    uncertain: insufficient + pending,
    unanchored,
    inference,
    summaryLines,
  };
}
