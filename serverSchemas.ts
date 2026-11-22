import { z } from "zod";
import { VALID_TRANSFORM_TYPES } from "./shared/nucleoPipeline";

const positiveIntegerEnv = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const httpUrl = z.string().trim().pipe(z.url({ protocol: /^https?$/ }));

export const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MAX_UPLOAD_BYTES: positiveIntegerEnv(15 * 1024 * 1024),
  RATE_LIMIT_MAX: positiveIntegerEnv(10),
  RATE_LIMIT_WINDOW_MS: positiveIntegerEnv(10 * 60 * 1000),
  APP_URL: httpUrl.or(z.literal("")).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  SUPABASE_URL: httpUrl.or(z.literal("")).optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_DEEP_MODEL: z.string().optional(),
  TRANSFORM_DEBUG: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

const optionalString = z.string().optional();
const strings = z.array(z.string());
const intent = z.enum(["understand", "study", "apply"]);
const generationMode = z.enum(["classic", "study-doc-beta"]);

export const transformTypeSchema = z.enum(VALID_TRANSFORM_TYPES);
export const transformRequestSchema = z.object({
  type: transformTypeSchema,
  text: optionalString,
  fileData: optionalString,
  mimeType: optionalString,
  preferredModel: optionalString,
  intent: intent.optional(),
  outputLanguage: optionalString,
  sourceLabel: optionalString,
  mapId: optionalString,
  userDisplayName: optionalString,
  depth: z.enum(["rapido", "estandar", "profundo"]).optional(),
  generationMode: generationMode.optional(),
  singleNucleoMode: z.boolean().optional(),
  segmentTitle: optionalString,
});

const sourceReference = z.object({
  label: z.string(),
  locator: z.string(),
  locatorKind: z.enum(["page", "section", "timestamp", "slide", "sheet", "chapter", "region", "general"]).optional(),
  excerpt: optionalString,
  note: optionalString,
});

const references = z.array(sourceReference).optional();
const block = z.object({
  type: z.enum(["prose", "callout", "list"]),
  text: z.string(),
  kind: z.enum(["action", "info", "alert"]).optional(),
  label: z.enum(["Idea clave", "Matiz", "Ejemplo", "Precaución", "Para aplicarlo"]).optional(),
  items: z.array(z.object({ strong: z.string(), span: optionalString })).optional(),
  references,
});

const step = z.object({
  id: z.string(),
  shortNav: z.string(),
  title: z.string(),
  time: z.string(),
  content: z.array(block),
  purpose: optionalString,
  references,
  selfCheck: z.string().nullish(),
});

const sourceMetadata = z.object({
  kind: z.enum(["text", "link", "youtube", "pdf", "image", "video", "file"]),
  label: z.string(),
  title: optionalString,
  author: optionalString,
  language: optionalString,
  detected: strings,
  limitations: strings.optional(),
});

const coverage = z.object({
  summary: z.string(),
  notes: z.array(z.object({
    label: z.string(),
    detail: z.string(),
    tone: z.enum(["neutral", "warning"]).optional(),
  })),
});

const completionCard = z.object({
  title: z.string(),
  summary: z.string(),
  takeaways: strings,
  promptQuestion: optionalString,
});

export const mapSchema = z.object({
  title: z.string(),
  category: optionalString,
  tags: strings.optional(),
  suggestedCategory: optionalString,
  suggestedTags: strings.optional(),
  intent: intent.optional(),
  outputLanguage: optionalString,
  mapVersion: z.number().optional(),
  generationMode: generationMode.optional(),
  sourceMetadata: sourceMetadata.optional(),
  coverage: coverage.optional(),
  coreIdea: z.string(),
  coreSupport: z.string(),
  tldr: z.array(z.object({ title: z.string(), desc: z.string() })),
  knowledgeSections: z.array(z.object({ title: z.string(), summary: z.string(), references })).optional(),
  readingSections: z.array(z.object({
    title: z.string(), fromStep: z.number(), toStep: z.number(),
  })).nullish(),
  steps: z.array(step),
  references,
  completionCard: completionCard.optional(),
  modelUsed: optionalString,
});

// Gemini can omit fields that the normalizer fills, especially in streamed snapshots.
export const generatedMapSchema = mapSchema.partial().extend({
  sourceMetadata: sourceMetadata.partial().optional(),
  coverage: coverage.partial().optional(),
  steps: z.array(step.partial().extend({
    autochequeo: optionalString,
    content: z.array(block.partial()).optional(),
  })).optional(),
  completionCard: completionCard.partial().optional(),
});
export type GeneratedMap = z.infer<typeof generatedMapSchema>;

export const mapParamsSchema = z.object({ id: z.string().min(1) });
export const mapPayloadSchema = z.object({ map: mapSchema.optional() });
export const mapChatRequestSchema = mapPayloadSchema.extend({
  question: z.string().trim().min(1),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).optional(),
});

export const geminiChatSchema = z.object({
  answer: optionalString,
  followUps: strings.optional(),
  citations: references,
  limitations: strings.optional(),
});

export const geminiPdfAnalysisSchema = z.object({
  shouldProposeSplit: z.boolean().optional(),
  collectionTitle: optionalString,
  totalWordsEstimate: z.number().optional(),
  parts: z.array(z.object({ title: optionalString })).optional(),
});

export const sdkErrorSchema = z.object({ message: optionalString, status: z.number().optional() });
export const geminiErrorSchema = z.object({
  error: z.object({
    message: optionalString,
    status: optionalString,
    code: z.number().optional(),
    details: z.array(z.object({
      "@type": optionalString,
      violations: z.array(z.object({ quotaId: optionalString })).optional(),
    })).optional(),
  }),
});

export const supabaseUserSchema = z.object({ id: z.string(), email: optionalString });
export const supabaseMapRowsSchema = z.array(z.object({
  session: z.object({ data: mapSchema }),
}));

export const transcriptSchema = z.array(z.object({ text: z.string() }));
