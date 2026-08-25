/**
 * Transform ingest bridge for /api/transform.
 * Implementation lives in `transformIngest.ts` and is wired from `server.ts`.
 * Kept so the ADR-002 path `server/src/routes/transform.ts` resolves.
 */
export {
  askResultShell,
  isAskLaneInput,
  prepareTransformIngest,
  IngestError,
  type PrepareIngestOutcome,
} from "./transformIngest";
