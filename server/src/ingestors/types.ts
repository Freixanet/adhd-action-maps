import type { IngestResult } from "../../../shared/types/chunk";

export type IngestorInput = {
  mime?: string;
  ext?: string;
  size?: number;
  text?: string;
  url?: string;
  buffer?: Buffer;
  fileName?: string;
  /** Optional cancel signal (S08 PDF extract and future long ingests). */
  signal?: AbortSignal;
};

export class IngestError extends Error {
  constructor(
    message: string,
    public readonly code: "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE" | "INGEST_FAILED" | "FEATURE_DISABLED",
    public readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export interface Ingestor {
  canHandle(input: {
    mime?: string;
    ext?: string;
    size?: number;
    text?: string;
  }): boolean;
  ingest(input: IngestorInput): Promise<IngestResult>;
}

export function expandedInputsEnabled(): boolean {
  return process.env.ENABLE_EXPANDED_INPUTS === "true";
}
