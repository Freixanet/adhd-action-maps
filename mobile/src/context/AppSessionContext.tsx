import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AccessibilityInfo, Keyboard } from 'react-native';
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  hapticCommit,
  hapticDrawer,
  hapticError,
  hapticSuccess,
  hapticToggle,
  hapticWarning,
} from '../logic/haptics';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { trackProductEvent } from '@shared/productTelemetry';
import {
  cancelIncompleteReminder,
  scheduleIncompleteReminder,
} from '../logic/incompleteReminder';
import type {
  ActionMapData,
  AskRequest,
  AskResponse,
  MapIntent,
  NucleoGenerationMode,
  SourceAnalysisResponse,
  SourceType,
  TransformRequest,
} from '../logic/contracts';
import { getBlockPlainText } from '@shared/stepContentBlocks';
import {
  deleteCloudHistoryEntryWithClient,
  migrateLocalHistoryWithClient,
  pullCloudHistoryWithClient,
  pushHistoryEntryWithClient,
  signOut,
} from '../logic/cloudHistory';
import { toCloudUserProfile } from '../logic/cloudUserProfile';
import { createSessionBoundSupabase } from '../logic/sessionBoundSupabase';
import {
  hydrateCloudHistoryForSession,
  type BoundMapsClient,
} from '@shared/cloudHistoryHydration';
import {
  captureMutationSnapshot,
  runBoundCloudMutation,
} from '@shared/cloudMutationExecutor';
import {
  createActiveAuthController,
  sessionIdentityFromSession,
} from '@shared/activeAuthSnapshot';
import {
  createPastedTextOperationIds,
  parsePastedTextSourceMeta,
  pastedTextErrorMessage,
  pastedTextUiMessage,
  validatePastedText,
  type PastedTextSourceMeta,
} from '@shared/pastedText';
import { createTransformRunController } from '@shared/transformRunController';
import { parsePdfSourceMeta } from '@shared/pdf/applyCoverageToMap';
import type { PdfSourceMeta, PdfPersistRetryPayload } from '@shared/pdf/types';
import {
  getPendingSourceSyncForMap,
  reconcilePendingSourceSyncWithHistory,
  removePendingSourceSync,
  upsertPendingSourceSync,
  type PendingSourceSyncItem,
} from '@shared/pendingSourceSync';
import {
  commitPendingPdfSourceSync,
  removePendingPdfSourceSync,
  removePendingPdfSourceSyncByMapId,
  clearPendingPdfSourceSyncForUser,
  pendingPdfSourceSyncIndexByMapId,
  getPendingPdfSourceSyncForMap,
  reconcilePendingPdfSourceSyncWithHistory,
  type PendingPdfSourceSyncItem,
} from '@shared/pendingPdfSourceSync';
import { readPendingPdfFile } from '@shared/pdf/pendingPdfFileIO';
import { ensureMobilePendingPdfFileIO } from '../logic/pendingPdfFileIO';
import {
  removePendingEvidenceSync,
  upsertPendingEvidenceSync,
  reconcilePendingEvidenceSyncWithHistory,
  flushPendingEvidenceSync,
  pendingEvidenceSyncIndexByMapId,
  getPendingEvidenceSyncForMap,
  EVIDENCE_SYNC_PENDING_MESSAGE,
  type PendingEvidenceSyncItem,
} from '@shared/pendingEvidenceSync';
import {
  canFlushEvidence,
  deriveSyncNotice,
  type SyncNoticeViewModel,
} from '@shared/syncNotice';
import { PersistRetryGate } from '@shared/persistRetryGate';
import { runOrderedPersistSync } from '@shared/persistSyncCoordinator';
import {
  captureDurableSyncPending,
  hasAnyDurableSyncPending,
} from '@shared/durableSyncPending';
import {
  resolveActiveSyncFailureCode,
  resolveActiveSyncSaving,
  toSyncFailureRecord,
  type PersistStepResult,
  type SyncFailureRecord,
  type SyncSavingTarget,
} from '@shared/persistStepResult';
import { sanitizePersistFailureCode } from '@shared/persistFailureCodes';
import { persistEvidenceWithUserJwt } from '@shared/evidence/persistEvidence';
import {
  upsertPendingApplicationOp,
  removePendingApplicationOp,
  removeAllPendingApplicationOpsForMap,
  flushPendingApplicationOps,
  loadPendingApplicationOps,
  sealPendingApplicationOpsForUser,
  clearPendingApplicationOpsForUser,
  pendingApplicationBannerMessage,
  reconcilePendingApplicationOpsWithHistory,
  isApplicationSyncPendingCopy,
  APPLICATION_SYNC_PENDING_MESSAGE,
  APPLICATION_EXECUTION_SYNC_PENDING_MESSAGE,
  APPLICATION_REVIEW_SYNC_PENDING_MESSAGE,
  type PendingApplicationOpKind,
} from '@shared/pendingApplicationOps';
import {
  applicationPlanDigest,
  attachApplicationReview,
  buildApplicationReview,
  persistApplicationExecutionWithUserJwt,
  persistApplicationReviewWithUserJwt,
  syncApplicationCloudState,
  toImmutableApplicationArtifact,
  startApplicationAction,
  applyEditableAssumptionTexts,
  replanApplicationFromEvidence,
  buildStagedReplan,
  attemptCloudReplan,
  consolidateGuestReplan,
  setActivePlanDigest,
  getActivePlanDigest,
  clearActivePlanDigest,
  clearActivePlanDigestsForUser,
  loadActivePlanDigests,
  preferUnderstandingWhenApplicationNeedsContext,
  type ApplicationContextV1,
  type ApplicationReviewOutcome,
  type ApplicationArtifactV1,
  type StagedReplanProposal,
} from '@shared/application';
import type { EvidenceArtifact } from '@shared/evidence/types';
import {
  buildStableCollectionPartBody,
  mintStableCollectionPartIdentities,
  splitTransformJsonPayload,
} from '@shared/collectionPartExecution';
import {
  activateHistoryOwner,
  createChatEntry,
  createCollection,
  createEntry,
  deleteEntry,
  getActiveEntry,
  getHistoryOwnershipEnvelope,
  loadHistory,
  registerNucleoInCollection,
  removeHistoryOwnerFromStorage,
  renameEntry,
  saveHistory,
  setActiveId,
  togglePinEntry,
  updateActiveSession,
  updateEntryCategory,
  updateEntrySourceMeta,
  updateEntryGeneratedCover,
  markCompletionCeremonyShown,
  type HistoryEntry,
  type HistoryStore,
} from '../logic/history';
import { isChatHistoryEntry, chatExchanges } from '@shared/historyKind';
import { visibleAskAnswer } from '../logic/visibleAskAnswer';
import {
  analyzeTransformSource,
  promptCollectionSplit,
} from '../logic/collectionAnalyze';
import {
  formatReadingProgressLabel,
} from '@shared/nucleoPipeline';
import { resolveClientIsPro } from '@shared/proEntitlement';
import { ensureVisualizeArtifact } from '@shared/visualizeCompiler';
import { normalizeMapData } from '../logic/mapData';
import { isLayer0Complete } from '@shared/layer0';
import {
  getInitialModelPreference,
  saveModelPreference,
  type ModelPreference,
} from '@shared/modelPreference';
import {
  getInitialDepthPreference,
  saveDepthPreference,
  type DepthPreference,
} from '../logic/depthPreference';
import {
  isBookAttachment,
  loadBundledQaMultipagePdf,
  pickFileAttachment,
  pickImageFromCamera,
  pickImageFromLibrary,
  type UploadedFile,
} from '../logic/attachments';
import { detectUrlInput, type TransformSourceKind } from '../logic/urlInput';
import {
  buildComposerSourceKey,
  resolveComposerIntent,
  type QaMultipagePdfIntent,
} from '../logic/intentPreselection';
import {
  clearComposerDraft,
  loadComposerDraft,
  saveComposerDraft,
} from '../logic/composerDraft';
import { shouldCollapsePastedText } from '../logic/composerText';
import { DEMO_NUCLEO_DATA, DEMO_NUCLEO_ID } from '../data/demoNucleo';
import { attachLumenCanvas, lumenCanvasToMap } from '@shared/lumen/toMap';
import { LUMEN_SAMPLE_CANVAS } from '@shared/lumen/samples';
import {
  LUMEN_CUMPLE_CANVAS,
  LUMEN_EV_CANVAS,
  LUMEN_GALLETAS_CANVAS,
} from '@shared/lumen/homeSampleCanvases';
import type { Canvas } from '@shared/lumen/types';
import type { EditorialPlan } from '@shared/editorial';
import {
  buildEditorialDemoMap,
  EDITORIAL_DEMO_NUCLEO_ID,
} from '../editorial/buildEditorialDemoMap';
import { loadDevToolsEnabled, saveDevToolsEnabled } from '../logic/devToolsPreference';
import {
  resolveStreamLoadPhase,
  STREAM_PROGRESS_MILESTONES,
  type StreamLoadPhase,
} from '../logic/streamGenerationProgress';
import {
  hideHistoryForDev,
  isDevHistoryHidden,
  restoreHistoryFromDev,
} from '../logic/devHistoryBackup';
import {
  fetchTransformWithProgress,
  isBetaQuotaExceededError,
  resolveTransformFallbackTimeoutMs,
  TRANSFORM_IDLE_TIMEOUT_MESSAGE,
  TransformHttpError,
} from '../logic/transformStream';
import { streamTrace } from '@shared/streamTrace';
import { mintGenerationRunId } from '@shared/generationResult';
import { apiUrl } from '../logic/apiBase';
import { buildLlmRequestHeaders } from '../logic/apiHeaders';
import { isCloudSyncConfigured, supabase } from '../logic/supabase';
import { fetchWithTimeout } from '../logic/network';
import { ensureNucleoCover } from '../logic/ensureNucleoCover';
import type { GeneratedCoverRecord } from '@shared/generatedCover';
import {
  CONTINUE_IMMEDIATE_BACK_MS,
  buildContinueChipLabel,
  type ContinueChipRect,
  type ContinueTransitionSnapshot,
} from '../logic/continueTransition';
import { useRevenueCatPro } from '../hooks/useRevenueCatPro';
import { debugTransitionLog } from '../logic/debugTransitionLog';
import { clearComposerNativeMenuSession, restoreComposerInputFocus } from '../logic/composerNativeMenuSession';
import {
  buildResumeSummary,
  restoreResumeUiState,
  selectPrimaryResumeEntry,
  sessionWithSemanticProgress,
  type ResumeSummary,
} from '@shared/progress';
import {
  flushPendingProgressSync,
  pendingProgressSyncIndex,
  PROGRESS_SYNC_PENDING_MESSAGE,
  removePendingProgressSync,
  upsertPendingProgressSync,
  type PendingProgressSyncItem,
} from '@shared/pendingProgressSync';

const LUMEN_HOME_CANVASES: Record<string, { title: string; canvas: Canvas }> = {
  'nucleo-formato-ejemplo': { title: 'Relatividad especial', canvas: LUMEN_SAMPLE_CANVAS },
  'nucleo-lumen-galletas': { title: 'Galletas extra chewy', canvas: LUMEN_GALLETAS_CANVAS },
  'nucleo-lumen-ev': { title: 'Model 3 vs Ioniq 6', canvas: LUMEN_EV_CANVAS },
  'nucleo-lumen-cumple': { title: 'Cumple de 8 años', canvas: LUMEN_CUMPLE_CANVAS },
};

function lumenHomeMap(id: string): ActionMapData | null {
  const spec = LUMEN_HOME_CANVASES[id];
  const canvas = spec?.canvas;
  if (!spec || !canvas?.title || !canvas.kind) return null;
  if (typeof lumenCanvasToMap === 'function') {
    try {
      const mapped = lumenCanvasToMap(canvas, { modelUsed: 'lumen-sample.v2' });
      if (mapped?.lumenCanvas) return mapped;
    } catch {
      /* fall through to the stub so the chip still opens */
    }
  }
  return {
    title: spec.title,
    intent: 'understand',
    outputLanguage: 'es',
    mapVersion: 2,
    generationMode: 'lumen-v1',
    lumenCanvas: canvas,
    sourceMetadata: { kind: 'text', label: spec.title, detected: [], limitations: [] },
    coverage: { summary: canvas.hook, notes: [] },
    coreIdea: canvas.hook,
    coreSupport: canvas.hook,
    tldr: [{ title: spec.title, desc: canvas.hook }],
    steps: [
      {
        id: 'lumen',
        shortNav: spec.title,
        title: spec.title,
        time: '~4 min',
        content: [{ type: 'prose', text: canvas.hook }],
      },
    ],
    completionCard: { title: spec.title, summary: canvas.hook, takeaways: [] },
  };
}

function insertLumenHomeSample(store: HistoryStore, id: string): HistoryStore {
  if (!store?.entries || store.entries.some((entry) => entry.id === id)) return store;
  const spec = LUMEN_HOME_CANVASES[id];
  const map = lumenHomeMap(id);
  if (!spec || !map) return store;
  const now = Date.now();
  return {
    ...store,
    entries: [
      {
        id,
        title: spec.title,
        createdAt: now,
        updatedAt: now,
        sourceType: 'text',
        pinned: true,
        pinnedAt: now,
        intent: 'understand',
        status: 'unread',
        session: {
          data: map,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        },
      },
      ...store.entries,
    ],
  };
}

export type AppPhase = 'input' | 'loading' | 'result';

export type InlineGenerationStatus =
  | 'idle'
  | 'generating'
  | 'partial'
  | 'ready'
  | 'error'
  | 'cancelled';

import {
  buildInlineUserTurnSnapshot,
  type InlineUserTurnSnapshot,
} from '../logic/inlineUserBubble';
import { classifyComposerSubmit } from '../logic/classifyComposerSubmit';
import {
  DEFAULT_HOME_SURFACE,
  homeSurfacePlaceholder,
  type HomeSurface,
} from '@shared/homeSurfaceModel';

export type { InlineUserTurnSnapshot } from '../logic/inlineUserBubble';

const INLINE_ACK_MESSAGES = [
  (name?: string) => (name ? `Perfecto ${name}, voy con ello.` : 'Perfecto, voy con ello.'),
  (name?: string) => (name ? `Dame un momento ${name}; te lo preparo.` : 'Dame un momento y te lo preparo.'),
  (name?: string) => (name ? `Recibido ${name}. Me pongo con ello.` : 'Recibido, me pongo con ello.'),
] as const;

function pickInlineConversationalMessage(displayName?: string | null): string {
  const firstName = displayName?.trim().split(/\s+/)[0];
  const index = Math.floor(Math.random() * INLINE_ACK_MESSAGES.length);
  const template = INLINE_ACK_MESSAGES[index] ?? INLINE_ACK_MESSAGES[0];
  return template(firstName);
}

function applyStudyDocBetaClientShape(map: ActionMapData): ActionMapData {
  const knowledgeSections =
    map.knowledgeSections?.length
      ? map.knowledgeSections
      : map.steps.slice(0, 9).map((step, index) => ({
          title: step.shortNav || `Concepto ${index + 1}`,
          summary: step.purpose || (step.content?.[0] ? getBlockPlainText(step.content[0]) : '') || step.title,
          references: step.references,
        }));

  const tldrFillers = [
    ...map.tldr,
    ...map.steps.map((step) => ({
      title: step.shortNav || step.title,
      desc: step.purpose || (step.content?.[0] ? getBlockPlainText(step.content[0]) : '') || step.title,
    })),
  ].filter((item) => item.title && item.desc);

  return {
    ...map,
    generationMode: 'study-doc-beta',
    tags: Array.from(new Set([...(map.tags ?? []), 'StudyDoc beta'])),
    tldr: tldrFillers.slice(0, 4),
    knowledgeSections,
    sourceMetadata: map.sourceMetadata
      ? {
          ...map.sourceMetadata,
          limitations: [
            ...(map.sourceMetadata.limitations ?? []).filter(
              (item) => item !== 'Generado en modo StudyDoc beta adaptado al renderer actual.'
            ),
            'Generado en modo StudyDoc beta adaptado al renderer actual.',
          ],
        }
      : map.sourceMetadata,
    steps: map.steps.map((step, index) => {
      const hasStudySignal = step.content.some((block) =>
        /pretest|comprueba|explica con tus palabras|self/i.test(getBlockPlainText(block))
      );
      const conceptName =
        knowledgeSections[index % Math.max(knowledgeSections.length, 1)]?.title ||
        step.shortNav ||
        step.title;

      return {
        ...step,
        title: /^Sección\s+\d+/i.test(step.title)
          ? step.title
          : `Sección ${index + 1}: ${step.title}`,
        purpose: hasStudySignal
          ? step.purpose
          : 'Pretest: léelo buscando cómo explicar esta sección con tus palabras.',
        content: hasStudySignal
          ? step.content
          : [
              {
                type: 'list' as const,
                text: 'Pretest rápido',
                kind: 'info' as const,
                items: [
                  {
                    strong: 'Antes de leer',
                    span: `¿Qué crees que significa "${conceptName}"?`,
                  },
                  {
                    strong: 'Conecta',
                    span: '¿Con qué idea anterior se relaciona?',
                  },
                ],
              },
              ...step.content,
            ],
        selfCheck:
          step.selfCheck ||
          `Explícale a alguien, sin mirar, qué aporta "${conceptName}" al Núcleo.`,
      };
    }),
  };
}

const MAX_SYNCED_ENTRIES = 30;
/** The loading bar animates to 100% (400ms fill) before inline ready / legacy overlay swap. */
const INTRO_TRANSITION_BAR_MS = 520;
const OFFLINE_TRANSFORM_MESSAGE = 'Sin conexión. Comprueba tu red y vuelve a intentarlo.';
const SERVER_UNREACHABLE_MESSAGE = 'No se pudo contactar el servidor. Inténtalo de nuevo.';
const GENERIC_TRANSFORM_ERROR = 'No se pudo procesar la fuente.';
const EXPANDED_INPUTS_DISABLED_MESSAGE =
  'Libros y fotos llegan en 2 días, ahora PDF y links';
const FILE_TOO_LARGE_MESSAGE = 'Máx 10MB para fotos, 20MB para libros';

function isTransientNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return (
    /network connection was lost/i.test(message) ||
    /fetch failed/i.test(message) ||
    /Failed to fetch/i.test(message) ||
    /Network request failed/i.test(message) ||
    /The Internet connection appears to be offline/i.test(message) ||
    /socket hang up/i.test(message) ||
    /ECONNRESET/i.test(message) ||
    /ETIMEDOUT/i.test(message) ||
    /timed out/i.test(message) ||
    /tardando demasiado/i.test(message)
  );
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isDeviceOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  // Do not use isInternetReachable: iOS reports false on working Wi-Fi / LAN.
  return state.isConnected === false;
}

function messageAfterFailedRequest(err: unknown, offline: boolean, fallback: string): string {
  if (offline) return OFFLINE_TRANSFORM_MESSAGE;
  if (isTransientNetworkError(err)) return SERVER_UNREACHABLE_MESSAGE;
  const message = err instanceof Error ? err.message : fallback;
  return message.trim() || fallback;
}

function mergeHistory(localEntries: HistoryEntry[], cloudEntries: HistoryEntry[]): HistoryEntry[] {
  const entries = new Map<string, HistoryEntry>();
  for (const entry of [...localEntries, ...cloudEntries]) {
    const existing = entries.get(entry.id);
    if (!existing || entry.updatedAt > existing.updatedAt) entries.set(entry.id, entry);
  }
  return [...entries.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SYNCED_ENTRIES);
}

function generateMapId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toSourceType(requestType: TransformRequest['type']): SourceType {
  if (requestType === 'image' || requestType === 'video') return 'file';
  return requestType;
}

/** Upload format for icons/labels — distinct from Gemini's rewritten body.type. */
function detectUploadFormat(
  request: TransformRequest
): 'pdf' | 'epub' | 'docx' | 'image' | 'video' | null {
  const mime = (request.mimeType ?? '').toLowerCase();
  const label = (request.sourceLabel ?? '').toLowerCase();
  if (request.type === 'image' || mime.startsWith('image/')) return 'image';
  if (request.type === 'video' || mime.startsWith('video/')) return 'video';
  if (mime.includes('epub') || label.endsWith('.epub')) return 'epub';
  if (mime.includes('wordprocessingml') || label.endsWith('.docx')) return 'docx';
  if (request.type === 'pdf' || mime === 'application/pdf' || label.endsWith('.pdf')) {
    return 'pdf';
  }
  return null;
}

function historySourceTypeForRequest(request: TransformRequest): SourceType {
  const format = detectUploadFormat(request);
  if (format === 'image' || format === 'video' || format === 'epub' || format === 'docx') {
    return 'file';
  }
  if (format === 'pdf') return 'pdf';
  return toSourceType(request.type);
}

/**
 * Stamp the real upload format onto sourceMetadata so icons stay accurate after
 * the server rewrites the body to extracted text (and collection parts lose the
 * original filename in sourceLabel).
 */
function withPersistedSourceFormat(
  map: ActionMapData,
  request: TransformRequest
): ActionMapData {
  const format = detectUploadFormat(request);
  if (!format || !map.sourceMetadata) return map;
  return {
    ...map,
    sourceMetadata: {
      ...map.sourceMetadata,
      kind: format,
    },
  };
}

function asHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

/** Keep the paste/Youtube URL on the map so Fuente survives reopen after the model renames the label. */
function withPersistedSourceUrl(
  map: ActionMapData,
  request: TransformRequest
): ActionMapData {
  if (!map.sourceMetadata) return map;
  const requestUrl =
    request.type === 'youtube' || request.type === 'link'
      ? asHttpUrl(request.text) || asHttpUrl(request.sourceLabel)
      : null;
  const existingUrl =
    asHttpUrl(map.sourceMetadata.url) || asHttpUrl(map.sourceMetadata.label);
  const url = existingUrl || requestUrl;
  if (!url && request.type !== 'youtube' && request.type !== 'link') {
    return map;
  }

  const kind =
    request.type === 'youtube' || request.type === 'link'
      ? request.type
      : map.sourceMetadata.kind;
  let label = map.sourceMetadata.label;
  if (asHttpUrl(label) && map.sourceMetadata.title?.trim()) {
    label = map.sourceMetadata.title.trim();
  }

  return {
    ...map,
    sourceMetadata: {
      ...map.sourceMetadata,
      kind,
      url: url ?? map.sourceMetadata.url,
      label,
    },
  };
}

function resolveTransformSourceKind(
  uploadedFile: UploadedFile | null,
  urlDetection: ReturnType<typeof detectUrlInput> | null
): TransformSourceKind {
  if (uploadedFile?.isPdf || uploadedFile?.isEpub || uploadedFile?.isDocx) return 'pdf';
  if (uploadedFile?.isVideo) return 'video';
  if (uploadedFile?.isImage) return 'image';
  if (urlDetection?.kind === 'youtube') return 'youtube';
  if (urlDetection?.kind === 'link') return 'link';
  return 'text';
}

const ApplicationReplanConfirmDialog = React.lazy(
  () => import('../components/ApplicationReplanConfirmDialog')
);

type AppSessionContextValue = {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
  inputText: string;
  setInputText: (text: string) => void;
  pastedText: string | null;
  handleComposerTextChange: (text: string) => void;
  removePastedText: () => void;
  intent: MapIntent;
  setIntent: (intent: MapIntent) => void;
  /** S06 — minimal apply context (goal/situation/constraint/horizon). */
  applicationContext: import('@shared/application').ApplicationContextV1;
  setApplicationContext: (ctx: import('@shared/application').ApplicationContextV1) => void;
  patchActiveApplication: (
    application: import('@shared/application').ApplicationArtifactV1
  ) => void;
  /** Opens the real context editor from result (not only setIntent). */
  applicationContextEditorOpen: boolean;
  openApplicationContextEditor: () => void;
  closeApplicationContextEditor: () => void;
  startActiveApplicationAction: () => Promise<void>;
  replanActiveApplication: (
    ctx: ApplicationContextV1,
    assumptionEdits?: Record<string, string>
  ) => Promise<void>;
  confirmStagedReplanReplace: () => Promise<void>;
  cancelStagedReplan: () => void;
  stagedReplanConfirmOpen: boolean;
  submitActiveApplicationReview: (args: {
    outcome: ApplicationReviewOutcome;
    privateNote?: string;
    failedAssumptionId?: string;
    wantsAdjust: boolean;
    wantsRepeat: boolean;
  }) => Promise<'ok' | 'pending' | 'error'>;
  handlePersistApplicationSync: (mapId?: string) => Promise<void>;
  applicationSyncPending: boolean;
  applicationReviewSyncPending: boolean;
  canRetryApplicationSync: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  data: ActionMapData | null;
  historyStore: HistoryStore;
  applyGeneratedCover: (id: string, cover: GeneratedCoverRecord) => void;
  currentStep: number;
  isComplete: boolean;
  viewAll: boolean;
  /** Still on Capa 0 (first page). False after “Ver núcleo completo”. */
  layer0Passed: boolean;
  layer0CheckedActionIds: string[];
  passLayer0: () => void;
  toggleLayer0Action: (actionId: string) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  openHistoryDrawer: () => void;
  closeHistoryDrawer: () => void;
  toggleHistoryDrawer: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  openAuthSheet: () => void;
  betaQuotaOpen: boolean;
  setBetaQuotaOpen: (open: boolean) => void;
  paywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  openPaywall: () => void;
  cloudUserId: string | null;
  cloudUserEmail: string | null;
  cloudUserDisplayName: string | null;
  cloudUserAvatarUrl: string | null;
  cloudSignedIn: boolean;
  isPro: boolean;
  isCloudSyncConfigured: boolean;
  uploadedFile: UploadedFile | null;
  attachMenuOpen: boolean;
  setAttachMenuOpen: (open: boolean) => void;
  modelPreference: ModelPreference;
  setModelPreference: (value: ModelPreference) => void;
  depthPreference: DepthPreference;
  setDepthPreference: (value: DepthPreference) => void;
  generationMode: NucleoGenerationMode;
  setGenerationMode: (value: NucleoGenerationMode) => void;
  homeSurface: HomeSurface;
  setHomeSurface: (value: HomeSurface) => void;
  totalSteps: number;
  canSubmit: boolean;
  hideTextInput: boolean;
  composerPlaceholder: string;
  hasAnyNucleo: boolean;
  continueEntry: HistoryEntry | null;
  /** Exact context recovered from the durable session. */
  resumeSummary: ResumeSummary | null;
  resumeBannerVisible: boolean;
  dismissResumeBanner: () => void;
  dismissContinueChip: () => void;
  progressLabel: string;
  stepProgress: number;
  goToStep: (idx: number, fromViewAll?: boolean) => void;
  syncReadingStep: (step: number) => void;
  toggleViewMode: () => void;
  handleCancelLoading: () => void;
  handlePickImage: () => Promise<void>;
  handlePickCamera: () => Promise<void>;
  handlePickFile: () => Promise<void>;
  /** DEV/QA: attach bundled multipage PDF and pin Entender or Aplicar. */
  handleLoadQaMultipagePdf: (intent: QaMultipagePdfIntent) => Promise<void>;
  removeUploadedFile: () => void;
  handleTransform: () => Promise<void>;
  handlePersistSourceSync: (mapId?: string) => Promise<PersistStepResult | void>;
  handlePersistEvidenceSync: (mapId?: string) => Promise<PersistStepResult | void>;
  handlePersistProgressSync: (mapId?: string) => Promise<PersistStepResult | void>;
  /** Manual retry: source → evidence → progress for the active map. */
  handleOrderedPersistRetry: (mode?: 'auto' | 'manual') => Promise<void>;
  /** Stable sync banner model (not last setError). */
  syncNotice: SyncNoticeViewModel | null;
  /** Active-map failure code only (ownerId + mapId scoped). */
  lastSyncFailureCode: string | null;
  dismissSyncNotice: () => void;
  handleComposerSubmit: () => Promise<void>;
  /** True when the active/inline map has a recoverable sync_failed pending. */
  sourceSyncPending: boolean;
  /** Evidence graph pending owner-scoped retry (no Gemini). */
  evidenceSyncPending: boolean;
  /** S07 map/session progress waiting for a bound cloud retry. */
  progressSyncPending: boolean;
  /** Persist retry is only armed after generation is ready (not mid-generate). */
  canRetryPersistSync: boolean;
  canRetryEvidenceSync: boolean;
  canRetryProgressSync: boolean;
  pendingSyncByMapId: Record<string, PendingSourceSyncItem>;
  pendingEvidenceSyncByMapId: Record<string, PendingEvidenceSyncItem>;
  pendingProgressSyncByMapId: Record<string, PendingProgressSyncItem>;
  handleOpenDemoNucleo: () => void;
  /** User-toggled DEV tools (Ajustes). Unlocks attach-menu previews. */
  devToolsEnabled: boolean;
  setDevToolsEnabled: (enabled: boolean) => void;
  /** Active editorial fixture plan — PhaseRouter shows EditorialDemoScreen. */
  editorialDemoPlan: EditorialPlan | null;
  /** DEV: open full-screen editorial fixture (bypasses classic ResultScreen). */
  openEditorialDemo: (fixtureId?: 'procrastination' | 'attention') => void;
  closeEditorialDemo: () => void;
  devHistoryHidden?: boolean;
  devHideHistory?: () => void;
  devRestoreHistory?: () => void;
  previewInlineGeneration?: () => void;
  /** DEV: open the pre-map chat at ready (Abrir Núcleo), without waiting the full preview. */
  previewPreMapChat?: () => void;
  /** True while DEV “Preview generation” is simulating the inline flow. */
  devPreviewGenerationActive?: boolean;
  previewLoadingScreen?: () => void;
  /** DEV tools: open live ResultScreen with fresh demo Núcleo data. */
  previewNucleo?: () => void;
  /** DEV: sent Chat bubble + Thinking orb, no assistant answer. */
  previewChatThinking?: () => void;
  handleNewMap: () => void;
  handleSelectHistory: (id: string) => void;
  beginContinueTransition: (id: string, chipRect: ContinueChipRect, chipLabel: string) => void;
  markContinueHandoffLayoutReady: () => void;
  registerContinueHandoffGlassTarget: () => void;
  notifyContinueHandoffGlassActive: () => void;
  completeContinueTransitionHandoff: () => void;
  finishContinueExpandTransition: () => void;
  finishContinueCollapseTransition: () => void;
  startReverseContinueTransition: () => boolean;
  canReverseContinueTransition: () => boolean;
  continueTransition: ContinueTransitionSnapshot | null;
  continueTransitionHandoff: boolean;
  /** Keeps eager glass mount briefly after overlay removal for late surfaces. */
  continueHandoffPrewarm: boolean;
  handleDeleteHistory: (id: string) => void;
  handleRenameHistory: (id: string, title: string) => void;
  handleUpdateCategory: (category: string) => void;
  handleUpdateEntryCategory: (id: string, category: string) => void;
  handlePinHistory: (id: string) => void;
  handleCompleteMap: () => void;
  triggerCompletionCeremonyIfNeeded: () => boolean;
  essentialsReview: boolean;
  setEssentialsReview: (value: boolean) => void;
  handleDownloadPdf: () => Promise<void>;
  handleDownloadPdfForEntry: (entryId: string) => Promise<void>;
  enterCompletedViewAll: () => void;
  isStreamGenerating: boolean;
  isAnalyzingSource: boolean;
  collectionGenerationProgress: { completed: number; total: number } | null;
  streamLoadPhase: StreamLoadPhase;
  streamProgressShared: SharedValue<number>;
  loadingFadeOverlayActive: boolean;
  completeLoadingFadeOverlay: () => void;
  isPdfGenerating: boolean;
  transformIncomplete: boolean;
  dismissTransformIncomplete: () => void;
  persistComposerDraft: () => void;
  beginComposerEdit: (text: string) => void;
  handleSignOut: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
  inlineGenerationStatus: InlineGenerationStatus;
  inlineUserTurn: InlineUserTurnSnapshot | null;
  /** Full ask answer once the /api/ask response arrives (typed out in the thread). */
  inlineAskAnswer: string | null;
  /** Completed Q&A pairs above the current ask turn. */
  inlineAskPriorTurns: Array<{ question: string; answer: string }>;
  /** History id of the open chat, if any. */
  activeChatId: string | null;
  /** Unverified-knowledge disclaimer shown under the ask answer. */
  inlineAskDisclaimer: string | null;
  /** CTA label under the ask answer (e.g. Añadir fuente para verificar). */
  inlineAskCtaLabel: string | null;
  /** Model route for the current ask answer (DEV inspect). */
  inlineAskModelUsed: string | null;
  cancelInlineAutoOpen: () => void;
  registerInlineAutoOpenCancel: (handler: (() => void) | null) => void;
  openInlineResult: (chipRect: ContinueChipRect) => void;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const initialHistory = useMemo(() => loadHistory(), []);
  const initialActive = useMemo(() => {
    const entry = getActiveEntry(initialHistory);
    return entry && !isChatHistoryEntry(entry) ? entry : null;
  }, [initialHistory]);
  const initialActiveData = useMemo(
    () => {
      const normalized = initialActive
        ? normalizeMapData(initialActive.session.data)
        : null;
      return normalized
        ? preferUnderstandingWhenApplicationNeedsContext(normalized)
        : null;
    },
    [initialActive]
  );
  const initialResumeState = useMemo(
    () =>
      initialActive && initialActiveData
        ? restoreResumeUiState(initialActiveData, initialActive.session)
        : null,
    [initialActive, initialActiveData]
  );

  const [phase, setPhase] = useState<AppPhase>(initialActiveData ? 'result' : 'input');
  const [inputText, setInputText] = useState('');
  const [pastedText, setPastedText] = useState<string | null>(null);
  const inputTextRef = useRef('');
  const [intent, setIntentState] = useState<MapIntent>(initialActiveData?.intent ?? 'understand');
  const [applicationContext, setApplicationContext] = useState<
    ApplicationContextV1
  >({});
  const [applicationContextEditorOpen, setApplicationContextEditorOpen] =
    useState(false);
  const [stagedReplan, setStagedReplan] = useState<StagedReplanProposal | null>(null);
  const [stagedReplanBusy, setStagedReplanBusy] = useState(false);
  const [pendingApplicationSyncByMapId, setPendingApplicationSyncByMapId] = useState<
    Record<string, true>
  >({});
  const [pendingApplicationReviewSyncByMapId, setPendingApplicationReviewSyncByMapId] =
    useState<Record<string, true>>({});
  const [pendingProgressSyncByMapId, setPendingProgressSyncByMapId] = useState<
    Record<string, PendingProgressSyncItem>
  >({});
  /** Last successfully persisted immutable plan digest per map (memory; durable store mirrors). */
  const applicationPlanDigestRef = useRef<Record<string, string>>({});
  const stagedReplanRef = useRef<StagedReplanProposal | null>(null);  const [error, setError] = useState<string | null>(null);
  const [transformIncomplete, setTransformIncomplete] = useState(false);
  const [data, setData] = useState<ActionMapData | null>(initialActiveData);
  const [historyStore, setHistoryStore] = useState<HistoryStore>(initialHistory);
  const [currentStep, setCurrentStep] = useState(initialResumeState?.currentStep ?? 0);
  const [isComplete, setIsComplete] = useState(initialResumeState?.isComplete ?? false);
  const [viewAll, setViewAll] = useState(initialResumeState?.viewAll ?? false);
  const [layer0Passed, setLayer0Passed] = useState(
    initialResumeState?.layer0Passed ?? false
  );
  const [layer0CheckedActionIds, setLayer0CheckedActionIds] = useState<string[]>(
    initialResumeState?.layer0CheckedActionIds ?? []
  );
  const layer0PassedRef = useRef(layer0Passed);
  const layer0CheckedActionIdsRef = useRef(layer0CheckedActionIds);
  useEffect(() => {
    layer0PassedRef.current = layer0Passed;
  }, [layer0Passed]);
  useEffect(() => {
    layer0CheckedActionIdsRef.current = layer0CheckedActionIds;
  }, [layer0CheckedActionIds]);
  const [historyOpen, setHistoryOpenState] = useState(false);
  const [dismissedContinueId, setDismissedContinueId] = useState<string | null>(null);
  const [resumeBannerVisible, setResumeBannerVisible] = useState(
    Boolean(initialActive && !initialActive.session.isComplete)
  );
  const [continueTransition, setContinueTransition] = useState<ContinueTransitionSnapshot | null>(null);
  const [continueTransitionHandoff, setContinueTransitionHandoff] = useState(false);
  const [continueHandoffPrewarm, setContinueHandoffPrewarm] = useState(false);
  const continueTransitionEnteredAtRef = useRef<number | null>(null);
  const continueChipRectRef = useRef<ContinueChipRect | null>(null);
  const continueChipLabelRef = useRef<string>('');
  const continueEntryIdRef = useRef<string | null>(null);
  const continueHandoffFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continueHandoffLayoutReadyRef = useRef(false);
  const continueHandoffGlassExpectedRef = useRef(0);
  const continueHandoffGlassActiveRef = useRef(0);
  const continueHandoffPrewarmEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [devHistoryHidden, setDevHistoryHidden] = useState(() =>
    __DEV__ ? isDevHistoryHidden() : false
  );
  const [devToolsEnabled, setDevToolsEnabledState] = useState(() => loadDevToolsEnabled());
  const [editorialDemoPlan, setEditorialDemoPlan] = useState<EditorialPlan | null>(null);
  const devToolsEnabledRef = useRef(devToolsEnabled);
  useEffect(() => {
    devToolsEnabledRef.current = devToolsEnabled;
  }, [devToolsEnabled]);

  const setDevToolsEnabled = useCallback((enabled: boolean) => {
    setDevToolsEnabledState(enabled);
    saveDevToolsEnabled(enabled);
    hapticToggle(enabled);
  }, []);

  const canUseDevTools = useCallback(
    () => __DEV__ || devToolsEnabledRef.current,
    []
  );
  const historyOpenRef = useRef(false);

  const openHistoryDrawer = useCallback(() => {
    if (historyOpenRef.current) return;
    historyOpenRef.current = true;
    clearComposerNativeMenuSession();
    Keyboard.dismiss();
    hapticDrawer(true);
    setHistoryOpenState(true);
  }, []);

  const closeHistoryDrawer = useCallback(() => {
    if (!historyOpenRef.current) return;
    historyOpenRef.current = false;
    hapticDrawer(false);
    setHistoryOpenState(false);
  }, []);

  const toggleHistoryDrawer = useCallback(() => {
    if (historyOpenRef.current) closeHistoryDrawer();
    else openHistoryDrawer();
  }, [closeHistoryDrawer, openHistoryDrawer]);

  const setHistoryOpen = useCallback(
    (open: boolean) => {
      if (open) openHistoryDrawer();
      else closeHistoryDrawer();
    },
    [closeHistoryDrawer, openHistoryDrawer]
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [betaQuotaOpen, setBetaQuotaOpen] = useState(false);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [cloudUserDisplayName, setCloudUserDisplayName] = useState<string | null>(null);
  const [cloudUserAvatarUrl, setCloudUserAvatarUrl] = useState<string | null>(null);
  const { revenueCatPro, paywallOpen, setPaywallOpen, openPaywall } = useRevenueCatPro(cloudUserId);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelPreference, setModelPreferenceState] = useState<ModelPreference>(() =>
    getInitialModelPreference()
  );
  const [depthPreference, setDepthPreferenceState] = useState<DepthPreference>(() =>
    getInitialDepthPreference()
  );
  const [generationMode] = useState<NucleoGenerationMode>('lumen-v1');
  const [homeSurface, setHomeSurfaceState] = useState<HomeSurface>(DEFAULT_HOME_SURFACE);
  const [essentialsReview, setEssentialsReview] = useState(false);
  const [isStreamGenerating, setIsStreamGenerating] = useState(false);
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [collectionGenerationProgress, setCollectionGenerationProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [streamLoadPhase, setStreamLoadPhase] = useState<StreamLoadPhase>(0);
  const streamProgressShared = useSharedValue(0);
  const [loadingFadeOverlayActive, setLoadingFadeOverlayActive] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [inlineGenerationStatus, setInlineGenerationStatus] = useState<InlineGenerationStatus>('idle');
  const [inlineUserTurn, setInlineUserTurn] = useState<InlineUserTurnSnapshot | null>(null);
  const [inlineAskAnswer, setInlineAskAnswer] = useState<string | null>(null);
  const [inlineAskPriorTurns, setInlineAskPriorTurns] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [inlineAskChatId, setInlineAskChatId] = useState<string | null>(null);
  const [inlineAskDisclaimer, setInlineAskDisclaimer] = useState<string | null>(null);
  const [inlineAskCtaLabel, setInlineAskCtaLabel] = useState<string | null>(null);
  const [inlineAskModelUsed, setInlineAskModelUsed] = useState<string | null>(null);
  const [devPreviewGenerationActive, setDevPreviewGenerationActive] = useState(false);

  const streamProgressCapRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const phaseRef = useRef(phase);
  const inlineGenerationStatusRef = useRef(inlineGenerationStatus);
  const inlineResultEntryIdRef = useRef<string | null>(null);
  const inlineAutoOpenCancelRef = useRef<(() => void) | null>(null);
  const inlineReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layer0EarlyOpenRef = useRef(false);
  const inlineRetryPayloadRef = useRef<{
    body: TransformRequest;
    headers?: Record<string, string>;
    sourceKind: TransformSourceKind;
  } | null>(null);
  /** Keep binary attachment so 501 can restore the composer chip. */
  const lastSubmittedFileRef = useRef<UploadedFile | null>(null);
  const askRetryQuestionRef = useRef<string | null>(null);
  const askRewoundRef = useRef(false);
  /** Question the user chose to edit; rewind only happens on send. */
  const pendingAskEditRef = useRef<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const transformRunRef = useRef(createTransformRunController());
  /** Independent of transform runs — must not abort generation. */
  const persistSyncAbortRef = useRef<AbortController | null>(null);
  const persistRetryGateRef = useRef(new PersistRetryGate({ minIntervalMs: 8_000 }));
  const orderedPersistRetryRef = useRef<(mode?: 'auto' | 'manual') => Promise<void>>(
    async () => {}
  );
  const [sourceSaving, setSourceSaving] = useState<SyncSavingTarget | null>(null);
  const [evidenceSaving, setEvidenceSaving] = useState<SyncSavingTarget | null>(null);
  const [syncFailure, setSyncFailure] = useState<SyncFailureRecord | null>(null);
  const [dismissedSyncNoticeKey, setDismissedSyncNoticeKey] = useState<string | null>(null);
  /** Maps whose evidence graph was confirmed persisted this session (or after flush). */
  const [evidenceCloudConfirmedByMapId, setEvidenceCloudConfirmedByMapId] = useState<
    Record<string, true>
  >({});

  const recordSyncFailure = useCallback((result: PersistStepResult) => {
    const next = toSyncFailureRecord(result);
    if (next) setSyncFailure(next);
  }, []);

  const clearSyncFailureFor = useCallback(
    (ownerId: string, mapId: string, kind?: SyncFailureRecord['kind']) => {
      setSyncFailure((current) => {
        if (!current) return current;
        if (current.ownerId !== ownerId || current.mapId !== mapId) return current;
        if (kind && current.kind !== kind) return current;
        return null;
      });
    },
    []
  );
  const transformCancelledRef = useRef(false);
  const [pendingSyncByMapId, setPendingSyncByMapId] = useState<
    Record<string, PendingSourceSyncItem>
  >({});
  const [pendingEvidenceSyncByMapId, setPendingEvidenceSyncByMapId] = useState<
    Record<string, PendingEvidenceSyncItem>
  >({});
  const partialShownRef = useRef(false);
  const historyStoreRef = useRef(historyStore);
  const isPdfGeneratingRef = useRef(false);
  const sourceKeyRef = useRef('');
  /** Explicit intent (QA menu or IntentSelector) — preselection must not overwrite. */
  const intentPinnedRef = useRef<MapIntent | null>(null);
  const draftRestoredRef = useRef(false);

  const pendingDeletesRef = useRef<string[]>([]);
  /** Atomic {epoch, userId, accessToken} — never pair React cloudUserId with a separate token. */
  const activeAuthRef = useRef(createActiveAuthController());
  const introTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devPreviewTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'loading' && introTransitionTimeoutRef.current) {
      clearTimeout(introTransitionTimeoutRef.current);
      introTransitionTimeoutRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    inlineGenerationStatusRef.current = inlineGenerationStatus;
  }, [inlineGenerationStatus]);

  const clearDevPreviewTimers = useCallback(() => {
    for (const timer of devPreviewTimersRef.current) {
      clearTimeout(timer);
    }
    devPreviewTimersRef.current = [];
  }, []);

  const scheduleDevPreview = useCallback((fn: () => void, delayMs: number) => {
    const timer = setTimeout(fn, delayMs);
    devPreviewTimersRef.current.push(timer);
  }, []);

  useEffect(() => {
    return () => clearDevPreviewTimers();
  }, [clearDevPreviewTimers]);

  const clearInlineAutoOpen = useCallback(() => {
    inlineAutoOpenCancelRef.current?.();
  }, []);

  const cancelInlineAutoOpen = useCallback(() => {
    inlineAutoOpenCancelRef.current?.();
  }, []);

  const registerInlineAutoOpenCancel = useCallback((handler: (() => void) | null) => {
    inlineAutoOpenCancelRef.current = handler;
  }, []);

  const clearInlineReadyTimeout = useCallback(() => {
    if (inlineReadyTimeoutRef.current) {
      clearTimeout(inlineReadyTimeoutRef.current);
      inlineReadyTimeoutRef.current = null;
    }
  }, []);

  const clearInlineGeneration = useCallback(() => {
    clearInlineAutoOpen();
    clearInlineReadyTimeout();
    setDevPreviewGenerationActive(false);
    setInlineGenerationStatus('idle');
    setInlineUserTurn(null);
    setInlineAskAnswer(null);
    setInlineAskPriorTurns([]);
    setInlineAskChatId(null);
    setInlineAskDisclaimer(null);
    setInlineAskCtaLabel(null);
    setInlineAskModelUsed(null);
    inlineResultEntryIdRef.current = null;
    inlineRetryPayloadRef.current = null;
    askRetryQuestionRef.current = null;
    pendingAskEditRef.current = null;
    askRewoundRef.current = false;
  }, [clearInlineAutoOpen, clearInlineReadyTimeout]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
  }, []);

  const resetStreamGenerationUi = useCallback(() => {
    streamProgressCapRef.current = 0;
    setStreamLoadPhase(0);
    streamProgressShared.value = 0;
    setLoadingFadeOverlayActive(false);
  }, [streamProgressShared]);

  const bumpStreamProgressCap = useCallback((cap: number) => {
    streamProgressCapRef.current = Math.max(streamProgressCapRef.current, cap);
    if (reduceMotionRef.current) {
      streamProgressShared.value = streamProgressCapRef.current;
    }
  }, [streamProgressShared]);

  const completeLoadingFadeOverlay = useCallback(() => {
    setLoadingFadeOverlayActive(false);
  }, []);

  useEffect(() => {
    if (
      !isStreamGenerating &&
      phase !== 'loading' &&
      !loadingFadeOverlayActive &&
      inlineGenerationStatus !== 'generating' &&
      inlineGenerationStatus !== 'partial'
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (reduceMotionRef.current) return;
      const current = streamProgressShared.value;
      const cap = streamProgressCapRef.current;
      if (current >= cap) return;
      const step = Math.max(0.35, (cap - current) * 0.055);
      streamProgressShared.value = Math.min(cap, current + step);
    }, 80);

    return () => clearInterval(interval);
  }, [inlineGenerationStatus, isStreamGenerating, loadingFadeOverlayActive, phase, streamProgressShared]);

  const pendingDeletesKey = useCallback((userId: string) => {
    return `nucleo_pending_deletes:user:${userId.trim()}`;
  }, []);

  const getPendingDeletes = useCallback((userId: string): string[] => {
    try {
      const val = localStorage.getItem(pendingDeletesKey(userId));
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
      }
    } catch (err) {
      console.error('Error al cargar la cola de borrados pendientes:', err);
    }
    return [];
  }, [pendingDeletesKey]);

  const savePendingDeletes = useCallback((userId: string, ids: string[]) => {
    try {
      const deduplicated = Array.from(new Set(ids));
      localStorage.setItem(pendingDeletesKey(userId), JSON.stringify(deduplicated));
    } catch (err) {
      console.error('Error al guardar la cola de borrados pendientes:', err);
    }
  }, [pendingDeletesKey]);

  const commitHistoryStore = useCallback((updatedStore: HistoryStore) => {
    historyStoreRef.current = updatedStore;
    saveHistory(updatedStore);
    setHistoryStore(updatedStore);
  }, []);

  const applyGeneratedCover = useCallback(
    (id: string, cover: GeneratedCoverRecord) => {
      commitHistoryStore(updateEntryGeneratedCover(historyStoreRef.current, id, cover));
    },
    [commitHistoryStore]
  );

  const pendingAuthRef = useRef(false);
  const cloudSignedIn = Boolean(cloudUserId);
  const isPro = useMemo(
    () => resolveClientIsPro({ email: cloudUserEmail, revenueCatPro }),
    [cloudUserEmail, revenueCatPro]
  );

  const totalSteps = data?.steps.length ?? 0;
  const composerBodyText = pastedText?.trim() ?? inputText.trim();
  const askTurnOpen =
    inlineUserTurn?.kind === 'ask' &&
    (inlineGenerationStatus === 'ready' ||
      inlineGenerationStatus === 'error' ||
      inlineGenerationStatus === 'cancelled');
  const canSubmit =
    Boolean(composerBodyText || uploadedFile) &&
    (inlineGenerationStatus === 'idle' ||
      askTurnOpen ||
      inlineGenerationStatus === 'cancelled');
  const hideTextInput = false;
  const composerPlaceholder = uploadedFile?.isVideo
    ? 'Añade una indicación sobre el video (opcional)…'
    : uploadedFile
      ? 'Añade una indicación (opcional)…'
      : homeSurfacePlaceholder(homeSurface);

  const hasAnyNucleo = historyStore.entries.some((entry) => !isChatHistoryEntry(entry));

  const continueEntry = useMemo(
    () => selectPrimaryResumeEntry(historyStore.entries),
    [historyStore.entries]
  );

  const resumeSummary = useMemo(() => {
    if (!data) return null;
    return buildResumeSummary(data, {
      data,
      currentStep,
      isComplete,
      viewAll,
      layer0Passed,
      layer0CheckedActionIds,
    });
  }, [
    currentStep,
    data,
    isComplete,
    layer0CheckedActionIds,
    layer0Passed,
    viewAll,
  ]);

  const dismissResumeBanner = useCallback(() => {
    setResumeBannerVisible(false);
  }, []);

  useEffect(() => {
    if (!continueEntry) {
      setDismissedContinueId(null);
      return;
    }
    if (dismissedContinueId && dismissedContinueId !== continueEntry.id) {
      setDismissedContinueId(null);
    }
  }, [continueEntry, dismissedContinueId]);

  const dismissContinueChip = useCallback(() => {
    if (continueEntry) setDismissedContinueId(continueEntry.id);
  }, [continueEntry]);

  const visibleContinueEntry = useMemo(() => {
    if (!continueEntry) return null;
    if (dismissedContinueId === continueEntry.id) return null;
    return continueEntry;
  }, [continueEntry, dismissedContinueId]);

  const setIntent = useCallback((value: MapIntent) => {
    intentPinnedRef.current = value;
    setIntentState(value);
  }, []);

  const persistComposerDraft = useCallback(() => {
    if (!inputText.trim() && !uploadedFile && !pastedText) {
      clearComposerDraft();
      return;
    }
    saveComposerDraft({ inputText, uploadedFile, pastedText });
  }, [inputText, pastedText, uploadedFile]);

  const beginComposerEdit = useCallback((text: string) => {
    const next = text.trim();
    if (!next) return;

    if (
      inlineGenerationStatusRef.current === 'generating' ||
      inlineGenerationStatusRef.current === 'partial'
    ) {
      transformCancelledRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setInlineGenerationStatus(inlineAskAnswer?.trim() ? 'ready' : 'cancelled');
    }

    pendingAskEditRef.current = next;
    setPastedText(null);
    setInputText(next);
    inputTextRef.current = next;
    requestAnimationFrame(() => restoreComposerInputFocus());
  }, [inlineAskAnswer]);

  const handleComposerTextChange = useCallback((text: string) => {
    const prev = inputTextRef.current;
    if (shouldCollapsePastedText(prev, text)) {
      setPastedText(text.trim());
      setInputText('');
      inputTextRef.current = '';
      return;
    }
    if (pendingAskEditRef.current && !text.trim()) {
      pendingAskEditRef.current = null;
    }
    setInputText(text);
    inputTextRef.current = text;
  }, []);

  const removePastedText = useCallback(() => {
    setPastedText(null);
  }, []);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  const progressLabel = useMemo(() => {
    if (isComplete) return 'Núcleo completado';
    if (viewAll) return 'Vista completa';
    if (currentStep === 0) return 'Idea central';
    return formatReadingProgressLabel(
      currentStep,
      totalSteps,
      data?.readingSections ?? null
    );
  }, [currentStep, data?.readingSections, isComplete, totalSteps, viewAll]);

  const stepProgress = useMemo(() => {
    if (isComplete || viewAll || !data || totalSteps === 0) return 0;
    if (currentStep === 0) return 0;
    return Math.round((Math.min(currentStep, totalSteps) / totalSteps) * 100);
  }, [currentStep, data, isComplete, totalSteps, viewAll]);

  const setModelPreference = useCallback((value: ModelPreference) => {
    setModelPreferenceState(value);
    saveModelPreference(value);
  }, []);

  const setDepthPreference = useCallback((value: DepthPreference) => {
    setDepthPreferenceState(value);
    saveDepthPreference(value);
  }, []);

  const setGenerationMode = useCallback((_value: NucleoGenerationMode) => {
    /* Selector removed — generation is locked to classic (interactive blocks). */
  }, []);

  const setHomeSurface = useCallback((value: HomeSurface) => {
    setHomeSurfaceState(value);
  }, []);

  useEffect(() => {
    if (uploadedFile || pastedText?.trim()) {
      setHomeSurfaceState('nucleo');
    }
  }, [uploadedFile, pastedText]);

  const replaceAskChatExchanges = useCallback(
    (chatId: string, exchanges: Array<{ question: string; answer: string }>) => {
      const current = historyStoreRef.current;
      let changed = false;
      const entries = current.entries.map((entry) => {
        if (entry.id !== chatId || entry.kind !== 'chat' || !entry.chat) return entry;
        changed = true;
        const first = exchanges[0];
        const last = exchanges[exchanges.length - 1];
        return {
          ...entry,
          updatedAt: Date.now(),
          chat: {
            ...entry.chat,
            question: first?.question ?? '',
            answer: last?.answer ?? '',
            exchanges,
          },
        };
      });
      if (changed) commitHistoryStore({ ...current, entries });
    },
    [commitHistoryStore]
  );

  const persistAskChat = useCallback(
    (input: {
      question: string;
      answer: string;
      title?: string | null;
      modelUsed?: string | null;
      chatId?: string | null;
    }): string | null => {
      const current = historyStoreRef.current;
      const question = input.question.trim();
      const answer = visibleAskAnswer(input.answer);
      if (!question || !answer) return input.chatId ?? null;

      if (input.chatId) {
        let changed = false;
        const entries = current.entries.map((entry) => {
          if (entry.id !== input.chatId || entry.kind !== 'chat' || !entry.chat) return entry;
          changed = true;
          const previous =
            Array.isArray(entry.chat.exchanges) && entry.chat.exchanges.length > 0
              ? entry.chat.exchanges.filter(
                  (item) => item.question.trim().length > 0 && item.answer.trim().length > 0
                )
              : entry.chat.question.trim() && entry.chat.answer.trim()
                ? [{ question: entry.chat.question, answer: entry.chat.answer }]
                : [];
          const exchanges = [...previous, { question, answer }];
          const first = exchanges[0];
          const last = exchanges[exchanges.length - 1];
          return {
            ...entry,
            updatedAt: Date.now(),
            chat: {
              question: first.question,
              answer: last.answer,
              exchanges,
              ...(input.modelUsed?.trim()
                ? { modelUsed: input.modelUsed.trim() }
                : entry.chat.modelUsed
                  ? { modelUsed: entry.chat.modelUsed }
                  : {}),
            },
          };
        });
        if (changed) {
          commitHistoryStore({ ...current, entries });
          return input.chatId;
        }
      }

      const created = createChatEntry(current, input);
      if (created === current) return input.chatId ?? null;
      commitHistoryStore(created);
      return created.entries[0]?.id ?? null;
    },
    [commitHistoryStore]
  );

  const saveStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type PendingPersist = {
    id: string;
    step: number;
    isComplete: boolean;
    viewAll: boolean;
    layer0Passed: boolean;
    layer0CheckedActionIds: string[];
  };
  const pendingPersistRef = useRef<PendingPersist | null>(null);

  const syncCloudEntry = useCallback((entry: HistoryEntry) => {
    if (isChatHistoryEntry(entry)) return;
    if (!supabase || !cloudSignedIn) return;

    const envelope = getHistoryOwnershipEnvelope();
    if (envelope.activeOwner.kind !== 'user') return;
    const ownerId = envelope.activeOwner.userId;
    const ownsEntry = (envelope.byUserId[ownerId]?.entries ?? []).some((e) => e.id === entry.id)
      || historyStoreRef.current.entries.some((e) => e.id === entry.id);
    if (!ownsEntry) return;

    // Capture the full auth unit — never pair React state with a separate token.
    const live = activeAuthRef.current.getSnapshot();
    if (!live || live.userId !== ownerId) return;
    if (!activeAuthRef.current.isCurrent(live.epoch, live.userId)) return;

    const snapshot = captureMutationSnapshot({
      epoch: live.epoch,
      activeUserId: live.userId,
      accessToken: live.accessToken,
    });
    if (!snapshot) return;

    let mapPushed = false;
    void runBoundCloudMutation({
      snapshot,
      gate: {
        isCurrent: (e, u) => activeAuthRef.current.isCurrent(e, u),
      },
      expectedOwnerId: ownerId,
      createClient: (snap) => {
        const bound = createSessionBoundSupabase(snap.accessToken);
        return {
          expectedUserId: snap.userId,
          push: (e: HistoryEntry) => pushHistoryEntryWithClient(bound, e),
          accessToken: snap.accessToken,
          userId: snap.userId,
        };
      },
      run: async (client) => {
        await client.push(entry);
        mapPushed = true;
        removePendingProgressSync(client.userId, entry.id);
        setPendingProgressSyncByMapId((prev) => {
          if (!prev[entry.id]) return prev;
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
        // S05: persist evidence graph only after maps row exists (session-bound JWT).
        const data = entry.session?.data as ActionMapData | undefined;
        const evidence = data?.evidence as EvidenceArtifact | undefined;
        const application = data?.application as ApplicationArtifactV1 | undefined;

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
        if (!supabaseUrl || !anonKey) return;

        const sourceId = entry.sourceMeta?.sourceId;
        const sourceVersionId = entry.sourceMeta?.sourceVersionId;
        const contentHash =
          entry.sourceMeta?.contentHash ||
          data?.understanding?.contentHash ||
          undefined;

        if (evidence && evidence.status === 'complete') {
          const result = await persistEvidenceWithUserJwt({
            accessToken: client.accessToken,
            supabaseUrl,
            supabaseAnonKey: anonKey,
            ownerId: client.userId,
            mapId: entry.id,
            sourceId,
            sourceVersionId,
            evidence,
            contentHash,
            isCurrent: () =>
              activeAuthRef.current.isCurrent(snapshot.epoch, snapshot.userId),
          });

          if (result.ok === true) {
            removePendingEvidenceSync(client.userId, entry.id);
            setPendingEvidenceSyncByMapId((prev) => {
              if (!prev[entry.id]) return prev;
              const next = { ...prev };
              delete next[entry.id];
              return next;
            });
            setEvidenceCloudConfirmedByMapId((prev) => ({
              ...prev,
              [entry.id]: true,
            }));
          } else if (result.code !== 'EVIDENCE_AUTH_STALE') {
            upsertPendingEvidenceSync(client.userId, {
              mapId: entry.id,
              sourceId,
              sourceVersionId,
              contentHash,
            });
            setEvidenceCloudConfirmedByMapId((prev) => {
              if (!prev[entry.id]) return prev;
              const next = { ...prev };
              delete next[entry.id];
              return next;
            });
            setPendingEvidenceSyncByMapId((prev) => ({
              ...prev,
              [entry.id]: {
                mapId: entry.id,
                sourceId,
                sourceVersionId,
                contentHash,
                updatedAt: Date.now(),
              },
            }));
          }
        }

        // S06: session holds rehydrated view with overlays; cloud plan RPC gets immutable core only.
        if (
          application &&
          (application.status === 'complete' ||
            application.status === 'provisional' ||
            application.status === 'needs_context' ||
            application.status === 'abstained')
        ) {
          const previousDigest =
            applicationPlanDigestRef.current[entry.id] ?? null;
          const syncResult = await syncApplicationCloudState({
            accessToken: client.accessToken,
            supabaseUrl,
            supabaseAnonKey: anonKey,
            ownerId: client.userId,
            mapId: entry.id,
            sourceId,
            sourceVersionId,
            application,
            previousPlanDigest: previousDigest,
            isCurrent: () =>
              activeAuthRef.current.isCurrent(snapshot.epoch, snapshot.userId),
            onPending: (kind, message) => {
              setPendingApplicationSyncByMapId((prev) => ({
                ...prev,
                [entry.id]: true,
              }));
              if (kind === 'review') {
                setPendingApplicationReviewSyncByMapId((prev) => ({
                  ...prev,
                  [entry.id]: true,
                }));
              }
              setError(message);
            },
            onClearPending: (kind) => {
              if (kind === 'plan' || kind === 'replan' || kind === 'execution') {
                setPendingApplicationSyncByMapId((prev) => {
                  if (!prev[entry.id]) return prev;
                  const next = { ...prev };
                  delete next[entry.id];
                  return next;
                });
              }
              if (kind === 'review') {
                setPendingApplicationReviewSyncByMapId((prev) => {
                  if (!prev[entry.id]) return prev;
                  const next = { ...prev };
                  delete next[entry.id];
                  return next;
                });
              }
            },
          });
          if (syncResult.plan?.ok) {
            const dig =
              syncResult.plan.planDigest ||
              applicationPlanDigest(toImmutableApplicationArtifact(application));
            applicationPlanDigestRef.current[entry.id] = dig;
            setActivePlanDigest(client.userId, entry.id, dig);
          }
        }
      },
      onErrorCurrent: (err) => {
        console.error(`Error al sincronizar el mapa ${entry.id} en la nube:`, err);
        if (!mapPushed) {
          upsertPendingProgressSync(ownerId, entry);
          setPendingProgressSyncByMapId((prev) => ({
            ...prev,
            [entry.id]: {
              mapId: entry.id,
              entryUpdatedAt: entry.updatedAt,
              queuedAt: Date.now(),
            },
          }));
          setError(PROGRESS_SYNC_PENDING_MESSAGE);
        }
      },
    });
  }, [cloudSignedIn]);

  const handlePersistProgressSync = useCallback(async (mapIdArg?: string): Promise<PersistStepResult> => {
    const live = activeAuthRef.current.getSnapshot();
    const mapId =
      mapIdArg ||
      inlineResultEntryIdRef.current ||
      historyStoreRef.current.activeId ||
      '';
    if (!live?.userId || !live.accessToken) {
      return {
        status: 'failed',
        kind: 'progress',
        ownerId: live?.userId || '',
        mapId,
        code: 'PROGRESS_AUTH_REQUIRED',
      };
    }
    if (!mapId) {
      return {
        status: 'failed',
        kind: 'progress',
        ownerId: live.userId,
        mapId: '',
        code: 'PROGRESS_NO_MAP',
      };
    }

    const gate = persistRetryGateRef.current;
    if (!gate.tryBeginManual(live.userId, mapId, 'progress')) {
      return {
        status: 'busy',
        kind: 'progress',
        ownerId: live.userId,
        mapId,
        code: 'PROGRESS_BUSY',
      };
    }

    const captured = { ...live };
    try {
      const bound = createSessionBoundSupabase(captured.accessToken);
      const result = await flushPendingProgressSync({
        userId: captured.userId,
        mapId,
        getEntry: (id) =>
          historyStoreRef.current.entries.find((entry) => entry.id === id) ?? null,
        push: (entry) => pushHistoryEntryWithClient(bound, entry),
        isCurrent: () =>
          activeAuthRef.current.isCurrent(captured.epoch, captured.userId),
      });
      if (result.stale) {
        return {
          status: 'stale',
          kind: 'progress',
          ownerId: captured.userId,
          mapId,
          code: 'PROGRESS_AUTH_STALE',
        };
      }
      setPendingProgressSyncByMapId(pendingProgressSyncIndex(captured.userId));
      if (result.failed.includes(mapId)) {
        const failed: PersistStepResult = {
          status: 'failed',
          kind: 'progress',
          ownerId: captured.userId,
          mapId,
          code: 'PROGRESS_PERSIST_FAILED',
        };
        recordSyncFailure(failed);
        setError(PROGRESS_SYNC_PENDING_MESSAGE);
        return failed;
      }
      if (result.synced.includes(mapId)) {
        clearSyncFailureFor(captured.userId, mapId, 'progress');
        setError((current) =>
          current === PROGRESS_SYNC_PENDING_MESSAGE ? null : current
        );
        return {
          status: 'success',
          kind: 'progress',
          ownerId: captured.userId,
          mapId,
        };
      }
      clearSyncFailureFor(captured.userId, mapId, 'progress');
      setError((current) =>
        current === PROGRESS_SYNC_PENDING_MESSAGE ? null : current
      );
      return {
        status: 'not_pending',
        kind: 'progress',
        ownerId: captured.userId,
        mapId,
      };
    } finally {
      gate.end(captured.userId, mapId, 'progress');
    }
  }, [clearSyncFailureFor, recordSyncFailure]);

  const flushPendingSessionPersist = useCallback(() => {
    const pending = pendingPersistRef.current;
    if (!pending) return;

    if (saveStepTimerRef.current) {
      clearTimeout(saveStepTimerRef.current);
      saveStepTimerRef.current = null;
    }

    const currentStore = historyStoreRef.current;
    const entry = currentStore.entries.find((e) => e.id === pending.id);
    if (!entry) {
      pendingPersistRef.current = null;
      return;
    }

    if (
      entry.session.currentStep === pending.step &&
      entry.session.isComplete === pending.isComplete &&
      entry.session.viewAll === pending.viewAll &&
      Boolean(entry.session.layer0Passed) === pending.layer0Passed &&
      JSON.stringify(entry.session.layer0CheckedActionIds ?? []) ===
        JSON.stringify(pending.layer0CheckedActionIds)
    ) {
      pendingPersistRef.current = null;
      return;
    }

    const now = Date.now();
    const entries = currentStore.entries.map((item) => {
      if (item.id !== pending.id) return item;

      const updatedSession = sessionWithSemanticProgress(
        {
          ...item.session,
          currentStep: pending.step,
          isComplete: pending.isComplete,
          viewAll: pending.viewAll,
          layer0Passed: pending.layer0Passed,
          layer0CheckedActionIds: pending.layer0CheckedActionIds,
        },
        item.session.data,
        now
      );

      return {
        ...item,
        updatedAt: now,
        session: updatedSession,
      };
    });

    const updatedStore = {
      ...currentStore,
      entries,
    };

    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((e) => e.id === pending.id);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }

    pendingPersistRef.current = null;
  }, [syncCloudEntry, commitHistoryStore]);

  const persistSessionState = useCallback(
    (
      step: number,
      complete: boolean,
      viewAllMode: boolean,
      options?: { layer0Passed?: boolean; layer0CheckedActionIds?: string[] }
    ) => {
    const scheduledActiveId = historyStoreRef.current.activeId;
    if (!scheduledActiveId) return;

    // Si hay una persistencia pendiente para otro mapa, la forzamos de inmediato
    if (pendingPersistRef.current && pendingPersistRef.current.id !== scheduledActiveId) {
      flushPendingSessionPersist();
    }

    pendingPersistRef.current = {
      id: scheduledActiveId,
      step,
      isComplete: complete,
      viewAll: viewAllMode,
      layer0Passed: options?.layer0Passed ?? layer0Passed,
      layer0CheckedActionIds: options?.layer0CheckedActionIds ?? layer0CheckedActionIds,
    };

    if (saveStepTimerRef.current) {
      clearTimeout(saveStepTimerRef.current);
    }

    saveStepTimerRef.current = setTimeout(() => {
      flushPendingSessionPersist();
    }, 800);
  }, [flushPendingSessionPersist, layer0CheckedActionIds, layer0Passed]);

  const passLayer0 = useCallback(() => {
    setLayer0Passed(true);
    persistSessionState(currentStep, isComplete, viewAll, { layer0Passed: true });
    hapticSuccess();
  }, [currentStep, isComplete, persistSessionState, viewAll]);

  const toggleLayer0Action = useCallback(
    (actionId: string) => {
      setLayer0CheckedActionIds((prev) => {
        const next = prev.includes(actionId)
          ? prev.filter((id) => id !== actionId)
          : [...prev, actionId];
        persistSessionState(currentStep, isComplete, viewAll, {
          layer0CheckedActionIds: next,
        });
        return next;
      });
    },
    [currentStep, isComplete, persistSessionState, viewAll]
  );

  useEffect(() => {
    return () => {
      flushPendingSessionPersist();
    };
  }, [flushPendingSessionPersist]);

  useEffect(() => {
    historyStoreRef.current = historyStore;
  }, [historyStore]);

  useEffect(() => {
    if (draftRestoredRef.current || initialActiveData) return;
    draftRestoredRef.current = true;
    const draft = loadComposerDraft();
    if (!draft) return;
    setInputText(draft.inputText);
    inputTextRef.current = draft.inputText;
    setPastedText(draft.pastedText ?? null);
    if (draft.uploadedFile) setUploadedFile(draft.uploadedFile);
    sourceKeyRef.current = buildComposerSourceKey(
      draft.inputText,
      draft.uploadedFile,
      draft.pastedText ?? null
    );
  }, [initialActiveData]);

  useEffect(() => {
    const key = buildComposerSourceKey(inputText, uploadedFile, pastedText);
    if (!key || key === 'text:') return;
    sourceKeyRef.current = key;
    const detection =
      !uploadedFile && composerBodyText ? detectUrlInput(composerBodyText) : null;
    const next = resolveComposerIntent({
      pinnedIntent: intentPinnedRef.current,
      text: composerBodyText,
      uploadedFile,
      urlDetection: detection,
    });
    setIntentState(next);
  }, [composerBodyText, inputText, pastedText, uploadedFile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // The OS may suspend JS before the debounce fires. Persist the exact
        // step/application surface before the app leaves the foreground.
        flushPendingSessionPersist();
        persistComposerDraft();
      }
    });
    return () => subscription.remove();
  }, [flushPendingSessionPersist, persistComposerDraft]);

  const openAuthSheet = useCallback(() => {
    // Close history first when it is open so the page-sheet Modal is not
    // buried under the drawer. If history is already closed (e.g. from the
    // beta-quota sheet), open auth immediately — setHistoryOpen(false) is a
    // no-op and would never re-trigger the pending-auth effect.
    if (historyOpenRef.current) {
      pendingAuthRef.current = true;
      setHistoryOpen(false);
      return;
    }
    pendingAuthRef.current = false;
    setAuthOpen(true);
  }, [setHistoryOpen]);

  const revealPendingAuth = useCallback(() => {
    if (!pendingAuthRef.current) return;
    pendingAuthRef.current = false;
    setAuthOpen(true);
  }, []);

  useEffect(() => {
    if (historyOpen || !pendingAuthRef.current) return;
    revealPendingAuth();
  }, [historyOpen, revealPendingAuth]);

  useEffect(() => {
    if (!supabase) return;

    const hydrateFromSession = async (session: import('@supabase/supabase-js').Session | null) => {
      const identity = sessionIdentityFromSession(session);
      const user = session?.user ?? null;
      const profile = user ? toCloudUserProfile(user) : null;

      // Atomic epoch+userId+token from the same Session object.
      const { epoch, applied } = activeAuthRef.current.applySession(identity);
      if (!applied) {
        // Same-user refresh ignored during delete/sign-out invalidation — do not resurrect UI.
        return;
      }
      const userId = identity?.userId ?? null;

      setCloudUserId(userId);
      setCloudUserDisplayName(profile?.displayName ?? null);
      setCloudUserEmail(profile?.email ?? null);
      setCloudUserAvatarUrl(profile?.avatarUrl ?? null);

      // Persist latest UI store into the active ownership partition before switching.
      saveHistory(historyStoreRef.current);

      const hooks = {
        isCurrent: (candidateEpoch: number, candidateUserId: string | null) =>
          activeAuthRef.current.isCurrent(candidateEpoch, candidateUserId),
        sealToGuest: () => {
          const sealed = activateHistoryOwner({ kind: 'guest' as const });
          return sealed.envelope.guest;
        },
        activateUser: (id: string) => {
          const ownership = activateHistoryOwner({ kind: 'user', userId: id });
          return {
            store:
              ownership.envelope.byUserId[id] ?? {
                activeId: null,
                entries: [],
                collections: [],
              },
            migrateEntries: ownership.cloudMigrateEntries,
          };
        },
        createBoundClient: (id: string, token: string): BoundMapsClient => {
          const bound = createSessionBoundSupabase(token);
          return {
            expectedUserId: id,
            migrate: (entries) => migrateLocalHistoryWithClient(bound, entries),
            pull: () => pullCloudHistoryWithClient(bound),
            deleteEntry: (entryId) => deleteCloudHistoryEntryWithClient(bound, entryId),
          };
        },
        loadPendingDeletes: (id: string) => getPendingDeletes(id),
        savePendingDeletes: (id: string, ids: string[]) => savePendingDeletes(id, ids),
        mergeHistory,
        commitStore: (store: HistoryStore) => {
          if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
          commitHistoryStore(store);
        },
        getCommittedStore: () => historyStoreRef.current,
        setSyncError: (message: string) => {
          if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
          setError(message);
        },
        clearPendingDeletesMemory: () => {
          if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
          pendingDeletesRef.current = [];
        },
        setPendingDeletesMemory: (ids: string[]) => {
          if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
          pendingDeletesRef.current = ids;
        },
      };

      await hydrateCloudHistoryForSession({
        epoch,
        userId,
        accessToken: identity?.accessToken ?? null,
        hooks,
        skipCloudSync: Boolean(__DEV__ && isDevHistoryHidden()),
      });

      if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
      if (userId) {
        ensureMobilePendingPdfFileIO();
        const store = historyStoreRef.current;
        const { pendingByMapId, entriesNeedingSyncBanner } =
          reconcilePendingSourceSyncWithHistory({
            userId,
            entries: store.entries,
          });
        const pdfKept = await reconcilePendingPdfSourceSyncWithHistory(
          userId,
          store.entries
        );
        const mergedPending = { ...pendingByMapId };
        for (const item of pdfKept) {
          mergedPending[item.mapId] = {
            mapId: item.mapId,
            sourceId: item.sourceId,
            sourceVersionId: item.sourceVersionId,
            sourceRequestId: item.sourceRequestId,
            canonicalText: '',
            contentHash: item.contentHash,
            title: item.title,
            updatedAt: item.updatedAt,
          };
        }
        setPendingSyncByMapId(mergedPending);
        void entriesNeedingSyncBanner;
        const evidenceReconcile = reconcilePendingEvidenceSyncWithHistory({
          userId,
          entries: store.entries,
        });
        setPendingEvidenceSyncByMapId(evidenceReconcile.pendingByMapId);
        const progressPending = pendingProgressSyncIndex(userId);
        setPendingProgressSyncByMapId(progressPending);
        const hydrateActiveId = store.activeId ?? inlineResultEntryIdRef.current;
        // Never call progress directly — ordered coordinator reads durable queues.
        if (
          hydrateActiveId &&
          (inlineGenerationStatusRef.current !== 'generating' && inlineGenerationStatusRef.current !== 'partial') &&
          hasAnyDurableSyncPending(
            captureDurableSyncPending(userId, hydrateActiveId)
          )
        ) {
          void orderedPersistRetryRef.current('auto');
        }
        const appPending =
          typeof reconcilePendingApplicationOpsWithHistory === 'function'
            ? reconcilePendingApplicationOpsWithHistory({
                userId,
                entries: store.entries,
              })
            : loadPendingApplicationOps(userId);
        // Restore CAS digests from durable store + local session artifacts.
        const storedDigests = loadActivePlanDigests(userId);
        applicationPlanDigestRef.current = {
          ...applicationPlanDigestRef.current,
          ...storedDigests,
        };
        for (const entry of historyStoreRef.current.entries) {
          const app = (entry.session.data as ActionMapData | undefined)?.application;
          if (!app) continue;
          if (!applicationPlanDigestRef.current[entry.id]) {
            const dig = applicationPlanDigest(toImmutableApplicationArtifact(app));
            applicationPlanDigestRef.current[entry.id] = dig;
            setActivePlanDigest(userId, entry.id, dig);
          }
        }
        setPendingApplicationSyncByMapId(
          Object.fromEntries(
            appPending
              .filter(
                (p) =>
                  p.kind !== 'review' &&
                  !p.awaitingConfirmation &&
                  !p.superseded
              )
              .map((p) => [p.mapId, true as const])
          )
        );
        setPendingApplicationReviewSyncByMapId(
          Object.fromEntries(
            appPending.filter((p) => p.kind === 'review').map((p) => [p.mapId, true as const])
          )
        );
        // Do not auto-flush awaiting_confirmation — that is a dialog state.
        const flushable = appPending.filter((p) => !p.awaitingConfirmation && !p.superseded);
        if (flushable.length && (inlineGenerationStatusRef.current !== 'generating' && inlineGenerationStatusRef.current !== 'partial')) {
          void flushPendingApplicationOps(
            userId,
            {
              accessToken: identity?.accessToken ?? '',
              supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '',
              supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '',
            },
            {
              getApplicationForMap: (mapId) => {
                const entry = historyStoreRef.current.entries.find((e) => e.id === mapId);
                return (
                  (entry?.session.data as ActionMapData | undefined)?.application ?? null
                );
              },
              isCurrent: () => activeAuthRef.current.isCurrent(epoch, userId),
            }
          ).then(() => {
            if (!activeAuthRef.current.isCurrent(epoch, userId)) return;
            const still = loadPendingApplicationOps(userId);
            setPendingApplicationSyncByMapId(
              Object.fromEntries(
                still
                  .filter(
                    (p) =>
                      p.kind !== 'review' &&
                      !p.awaitingConfirmation &&
                      !p.superseded
                  )
                  .map((p) => [p.mapId, true as const])
              )
            );
            setPendingApplicationReviewSyncByMapId(
              Object.fromEntries(
                still.filter((p) => p.kind === 'review').map((p) => [p.mapId, true as const])
              )
            );
          });
        }
        // Sync pending is shown via deriveSyncNotice on the active Núcleo,
        // never as a global home Error.
        setError((current) =>
          current === pastedTextUiMessage('sync_pending') ||
          current === EVIDENCE_SYNC_PENDING_MESSAGE ||
          (typeof isApplicationSyncPendingCopy === 'function' &&
            isApplicationSyncPendingCopy(current))
            ? null
            : current
        );
      } else {
        setPendingSyncByMapId({});
        setPendingEvidenceSyncByMapId({});
        setPendingProgressSyncByMapId({});
        setPendingApplicationSyncByMapId({});
        setPendingApplicationReviewSyncByMapId({});
      }
    };

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      void hydrateFromSession(sessionData.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateFromSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Eliminado el useEffect de sincronización global masiva para favorecer sync selectivo

  const goToStep = useCallback((idx: number, fromViewAll = false) => {
    const safeIdx = Math.max(0, Math.min(idx, totalSteps));
    setIsComplete(false);
    setCurrentStep(safeIdx);
    const nextViewAll = fromViewAll ? false : viewAll;
    if (fromViewAll) setViewAll(false);
    persistSessionState(safeIdx, false, nextViewAll);
    setResumeBannerVisible(false);
  }, [persistSessionState, totalSteps, viewAll]);

  const syncReadingStep = useCallback((step: number) => {
    const pageStep = Math.max(0, step);
    setCurrentStep((prev) => {
      if (prev === pageStep) return prev;
      persistSessionState(pageStep, isComplete, viewAll);
      return pageStep;
    });
  }, [persistSessionState, isComplete, viewAll]);

  const toggleViewMode = useCallback(() => {
    const nextViewAll = !viewAll;
    setViewAll(nextViewAll);
    setIsComplete(false);
    persistSessionState(currentStep, false, nextViewAll);
    hapticToggle(nextViewAll);
  }, [currentStep, persistSessionState, viewAll]);

  const dismissTransformIncomplete = useCallback(() => {
    setTransformIncomplete(false);
  }, []);

  const failTransform = useCallback(
    (message: string, partialShown: boolean, sourceKind: TransformSourceKind, offline = false) => {
      console.warn('Transform failed:', { message, sourceKind, offline });
      trackProductEvent('transform_error', { offline, partialShown });
      clearInlineReadyTimeout();
      clearInlineAutoOpen();

      const isBetaQuota =
        /quota_exceeded/i.test(message) ||
        /L[ií]mite beta alcanzado/i.test(message) ||
        /5 N[uú]cleos gratis/i.test(message);

      if (isBetaQuota) {
        setError(null);
        setTransformIncomplete(false);
        clearInlineGeneration();
        setInlineGenerationStatus('idle');
        setPhase('input');
        setBetaQuotaOpen(true);
        hapticWarning();
        return;
      }

      const isFreeLimit =
        /3 N[uú]cleos gratis/i.test(message) ||
        /free_limit/i.test(message) ||
        /l[ií]mite diario/i.test(message);
      if (isFreeLimit) {
        setPaywallOpen(true);
      }

      if (partialShown) {
        setTransformIncomplete(true);
        clearInlineGeneration();
        setPhase('result');
      } else {
        const userMessage = offline
          ? OFFLINE_TRANSFORM_MESSAGE
          : message.trim() &&
              message !== 'Failed to process content' &&
              message !== 'No se pudo procesar el contenido.'
            ? message
            : GENERIC_TRANSFORM_ERROR;
        setError(userMessage);
        setTransformIncomplete(false);
        setInlineGenerationStatus('error');
        setPhase('input');
      }

      hapticError();
    },
    [clearInlineAutoOpen, clearInlineGeneration, clearInlineReadyTimeout]
  );

  const handleCancelLoading = useCallback(() => {
    transformCancelledRef.current = true;
    transformRunRef.current.cancel();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    resetStreamGenerationUi();
    clearInlineAutoOpen();
    clearInlineReadyTimeout();

    if (partialShownRef.current) {
      setTransformIncomplete(true);
      clearInlineGeneration();
      setPhase('result');
    } else {
      setData(null);
      setTransformIncomplete(false);
      setError(null);
      setInlineGenerationStatus('cancelled');
      setPhase('input');
    }

    partialShownRef.current = false;
  }, [clearInlineAutoOpen, clearInlineGeneration, clearInlineReadyTimeout, resetStreamGenerationUi]);

  const handleAttachmentError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.';
    setError(message);
    hapticError();
  }, []);

  const handlePickImage = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const file = await pickImageFromLibrary();
      if (!file) return;
      intentPinnedRef.current = null;
      setUploadedFile(file);
      setError(null);
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const handlePickCamera = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const file = await pickImageFromCamera();
      if (!file) return;
      intentPinnedRef.current = null;
      setUploadedFile(file);
      setError(null);
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const handlePickFile = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const result = await pickFileAttachment();
      if (!result) return;

      intentPinnedRef.current = null;
      if ('textContent' in result) {
        setUploadedFile(result.file);
        setInputText(result.textContent);
      } else {
        setUploadedFile(result);
        if (isBookAttachment(result) || result.isVideo) setInputText('');
      }

      setError(null);
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const handleLoadQaMultipagePdf = useCallback(
    async (qaIntent: QaMultipagePdfIntent) => {
      setAttachMenuOpen(false);
      try {
        const file = await loadBundledQaMultipagePdf();
        intentPinnedRef.current = qaIntent;
        setIntentState(qaIntent);
        setUploadedFile(file);
        setInputText('');
        setError(null);
      } catch (err) {
        handleAttachmentError(err);
      }
    },
    [handleAttachmentError]
  );

  const removeUploadedFile = useCallback(() => {
    intentPinnedRef.current = null;
    setUploadedFile(null);
    if (isBookAttachment(uploadedFile) || uploadedFile?.isVideo) setInputText('');
  }, [uploadedFile]);

  const handleAsk = useCallback(async () => {
    const isAskRetry =
      inlineGenerationStatusRef.current === 'error' &&
      inlineUserTurn?.kind === 'ask' &&
      Boolean(askRetryQuestionRef.current);

    const question = isAskRetry
      ? (askRetryQuestionRef.current ?? '').trim()
      : (pastedText?.trim() ?? inputText.trim());
    if (!question) return;

    setError(null);
    setTransformIncomplete(false);
    setAttachMenuOpen(false);
    clearComposerDraft();
    clearDevPreviewTimers();

    const accessToken = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
    const headers = await buildLlmRequestHeaders(accessToken);

    const pendingEdit = pendingAskEditRef.current?.trim() || '';
    pendingAskEditRef.current = null;

    let remainingPriors = Array.isArray(inlineAskPriorTurns) ? inlineAskPriorTurns : [];
    const currentQuestion =
      inlineUserTurn?.kind === 'ask'
        ? inlineUserTurn.text?.trim() || inlineUserTurn.pastedText?.trim() || ''
        : '';
    let rewound = false;
    if (pendingEdit) {
      rewound = true;
      if (currentQuestion !== pendingEdit) {
        const idx = remainingPriors
          .map((turn) => turn.question.trim())
          .lastIndexOf(pendingEdit);
        remainingPriors = idx >= 0 ? remainingPriors.slice(0, idx) : remainingPriors;
      }
      setInlineAskPriorTurns(remainingPriors);
      if (inlineAskChatId) replaceAskChatExchanges(inlineAskChatId, remainingPriors);
    } else {
      rewound = askRewoundRef.current;
    }
    askRewoundRef.current = false;

    const continuing =
      !isAskRetry &&
      Boolean(inlineAskChatId) &&
      (
        (
          inlineUserTurn?.kind === 'ask' &&
          Boolean(inlineAskAnswer?.trim()) &&
          inlineGenerationStatusRef.current === 'ready'
        ) ||
        rewound
      );

    const historyForRequest: NonNullable<AskRequest['history']> = [];
    if (continuing) {
      for (const turn of remainingPriors) {
        historyForRequest.push(
          { role: 'user', text: turn.question },
          { role: 'assistant', text: turn.answer }
        );
      }
      if (!rewound && inlineUserTurn) {
        const prevQuestion =
          inlineUserTurn.text?.trim() || inlineUserTurn.pastedText?.trim() || '';
        const prevAnswer = inlineAskAnswer?.trim() ?? '';
        if (prevQuestion && prevAnswer) {
          historyForRequest.push(
            { role: 'user', text: prevQuestion },
            { role: 'assistant', text: prevAnswer }
          );
        }
      }
    }
    const threadChatId = continuing ? inlineAskChatId : null;

    if (!isAskRetry) {
      if (rewound) {
        setInlineAskAnswer(null);
        setInlineAskDisclaimer(null);
        setInlineAskCtaLabel(null);
        setInlineAskModelUsed(null);
        setInlineUserTurn(
          buildInlineUserTurnSnapshot({
            inputText: question,
            pastedText: null,
            uploadedFile: null,
            conversationalMessage: '',
            kind: 'ask',
          })
        );
        setInputText('');
        inputTextRef.current = '';
        setPastedText(null);
        setUploadedFile(null);
      } else if (continuing && inlineUserTurn) {
        const prevQuestion =
          inlineUserTurn.text?.trim() || inlineUserTurn.pastedText?.trim() || '';
        const prevAnswer = inlineAskAnswer?.trim() ?? '';
        if (prevQuestion && prevAnswer) {
          setInlineAskPriorTurns((prev) => [
            ...(Array.isArray(prev) ? prev : []),
            { question: prevQuestion, answer: prevAnswer },
          ]);
        }
        setInlineAskAnswer(null);
        setInlineAskDisclaimer(null);
        setInlineAskCtaLabel(null);
        setInlineAskModelUsed(null);
        setInlineUserTurn(
          buildInlineUserTurnSnapshot({
            inputText: question,
            pastedText: null,
            uploadedFile: null,
            conversationalMessage: '',
            kind: 'ask',
          })
        );
        setInputText('');
        inputTextRef.current = '';
        setPastedText(null);
        setUploadedFile(null);
      } else {
        clearInlineGeneration();
        clearInlineAutoOpen();
        clearInlineReadyTimeout();
        setInlineAskAnswer(null);
        setInlineAskDisclaimer(null);
        setInlineAskCtaLabel(null);
        setInlineAskModelUsed(null);
        setInlineUserTurn(
          buildInlineUserTurnSnapshot({
            inputText: question,
            pastedText: null,
            uploadedFile: null,
            conversationalMessage: '',
            kind: 'ask',
          })
        );
        setInputText('');
        inputTextRef.current = '';
        setPastedText(null);
        setUploadedFile(null);
      }
    } else {
      setInlineAskAnswer(null);
      setInlineAskDisclaimer(null);
      setInlineAskCtaLabel(null);
      setInlineAskModelUsed(null);
    }

    askRetryQuestionRef.current = question;
    setInlineGenerationStatus('generating');
    transformCancelledRef.current = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const body: AskRequest = {
      question,
      depth: depthPreference,
      userDisplayName: cloudUserDisplayName ?? undefined,
      preferredModel: modelPreference,
      ...(historyForRequest.length ? { history: historyForRequest } : {}),
    };

    try {
      const response = await fetchWithTimeout(
        apiUrl('/api/ask'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(headers ?? {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
        {
          timeoutMs: 60000,
          timeoutMessage: 'La respuesta está tardando demasiado. Inténtalo de nuevo.',
        }
      );

      if (transformCancelledRef.current) return;

      const parsed = (await response.json()) as AskResponse & { error?: string };
      if (!response.ok) {
        throw new Error(parsed?.error || 'No se pudo responder a esta pregunta.');
      }

      const answer = visibleAskAnswer(parsed.answer ?? '');
      if (!answer) {
        throw new Error('No se pudo responder a esta pregunta.');
      }

      if ((inlineGenerationStatusRef.current !== 'generating' && inlineGenerationStatusRef.current !== 'partial')) return;
      setInlineAskAnswer(answer);
      setInlineAskDisclaimer(null);
      setInlineAskCtaLabel(null);
      setInlineAskModelUsed(parsed.modelUsed?.trim() || null);
      const savedId = persistAskChat({
        question,
        answer,
        title: parsed.title,
        modelUsed: parsed.modelUsed,
        chatId: threadChatId,
      });
      if (savedId) setInlineAskChatId(savedId);
      setInlineGenerationStatus('ready');
      setPhase('input');
      hapticSuccess();
    } catch (err) {
      if (transformCancelledRef.current || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      const offline = await isDeviceOffline();
      setError(
        messageAfterFailedRequest(err, offline, 'No se pudo responder a esta pregunta.')
      );
      setInlineGenerationStatus('error');
      setPhase('input');
      hapticError();
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [
    clearComposerDraft,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineGeneration,
    clearInlineReadyTimeout,
    cloudUserDisplayName,
    depthPreference,
    inlineAskAnswer,
    inlineAskChatId,
    inlineAskPriorTurns,
    inlineUserTurn,
    inputText,
    modelPreference,
    pastedText,
    persistAskChat,
    replaceAskChatExchanges,
  ]);

  const handleTransform = useCallback(async () => {
    // Inline retry must run even with an empty composer: the first attempt clears
    // input/paste/file and keeps the request in inlineRetryPayloadRef.
    const bodyText = pastedText?.trim() ?? inputText.trim();
    const isInlineRetry =
      (inlineGenerationStatusRef.current === 'error' ||
        inlineGenerationStatusRef.current === 'cancelled') &&
      inlineRetryPayloadRef.current != null &&
      !bodyText &&
      !uploadedFile;
    if (!isInlineRetry && !bodyText && !uploadedFile) return;

    let urlDetection: ReturnType<typeof detectUrlInput> | null = null;
    if (!isInlineRetry && !uploadedFile && bodyText) {
      urlDetection = detectUrlInput(bodyText);
      if (urlDetection.kind === 'invalid') {
        setError(urlDetection.message);
        return;
      }
    }

    // Prefer atomic auth snapshot — never pair React cloudUserId with a separate token.
    const authSnap = activeAuthRef.current.getSnapshot();
    const accessToken = authSnap?.accessToken;

    let headers: Record<string, string> = {};
    let body: TransformRequest;
    let sourceKind: TransformSourceKind;
    let mapId = generateMapId();

    if (isInlineRetry && inlineRetryPayloadRef.current) {
      setInlineGenerationStatus('generating');
      // Reuse the original operation IDs (mapId/source*) — never mint a new mapId on retry.
      body = {
        ...inlineRetryPayloadRef.current.body,
        textMode: inlineRetryPayloadRef.current.body.textMode ?? 'source',
      };
      mapId = body.mapId || mapId;
      sourceKind = inlineRetryPayloadRef.current.sourceKind;
      inlineRetryPayloadRef.current = {
        ...inlineRetryPayloadRef.current,
        body,
        headers,
      };
    } else {
      sourceKind = resolveTransformSourceKind(uploadedFile, urlDetection);
      const sourceLabel =
        uploadedFile?.name || bodyText.split('\n')[0]?.slice(0, 80) || 'Fuente analizada';

      if (uploadedFile?.isPdf && uploadedFile.fileData) {
        const opIds = createPastedTextOperationIds();
        mapId = opIds.mapId;
        body = {
          type: 'pdf',
          fileData: uploadedFile.fileData,
          mimeType: uploadedFile.mimeType || 'application/pdf',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel,
          mapId: opIds.mapId,
          sourceId: opIds.sourceId,
          sourceVersionId: opIds.sourceVersionId,
          sourceRequestId: opIds.sourceRequestId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
      } else if (
        (uploadedFile?.isEpub || uploadedFile?.isDocx) &&
        uploadedFile.fileData
      ) {
        // Books ride the binary upload path; factory routes by mime/ext.
        const opIds = createPastedTextOperationIds();
        mapId = opIds.mapId;
        body = {
          type: 'pdf',
          fileData: uploadedFile.fileData,
          mimeType:
            uploadedFile.mimeType ||
            (uploadedFile.isEpub
              ? 'application/epub+zip'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel,
          mapId: opIds.mapId,
          sourceId: opIds.sourceId,
          sourceVersionId: opIds.sourceVersionId,
          sourceRequestId: opIds.sourceRequestId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
      } else if (uploadedFile?.isVideo && uploadedFile.fileData) {
        body = {
          type: 'video',
          fileData: uploadedFile.fileData,
          mimeType: uploadedFile.mimeType || 'video/mp4',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel,
          mapId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
        if (inputText.trim()) body.text = inputText.trim();
      } else if (uploadedFile?.isImage && uploadedFile.fileData) {
        body = {
          type: 'image',
          fileData: uploadedFile.fileData,
          mimeType: uploadedFile.mimeType || 'image/jpeg',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel,
          mapId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
        if (inputText.trim()) body.text = inputText.trim();
      } else if (urlDetection?.kind === 'youtube') {
        body = {
          text: urlDetection.url,
          type: 'youtube',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel: urlDetection.url,
          mapId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
      } else if (urlDetection?.kind === 'link') {
        body = {
          text: urlDetection.url,
          type: 'link',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel: urlDetection.url,
          mapId,
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
      } else if (uploadedFile && !uploadedFile.fileData) {
        setError('No se pudo leer el archivo adjunto.');
        setPhase('input');
        return;
      } else {
        const validation = validatePastedText(bodyText);
        if (validation.ok === false) {
          setError(pastedTextErrorMessage(validation.code));
          setPhase('input');
          return;
        }
        const opIds = createPastedTextOperationIds();
        mapId = opIds.mapId;
        body = {
          text: validation.canonical,
          type: 'text',
          preferredModel: modelPreference,
          intent,
          depth: depthPreference,
          generationMode,
          outputLanguage: 'es',
          sourceLabel,
          mapId: opIds.mapId,
          sourceId: opIds.sourceId,
          sourceVersionId: opIds.sourceVersionId,
          sourceRequestId: opIds.sourceRequestId,
          textMode: 'source',
          userDisplayName: cloudUserDisplayName ?? undefined,
        };
      }

      // Composer clear + generating UI happen after offline check (first await).
      lastSubmittedFileRef.current = uploadedFile;
      inlineRetryPayloadRef.current = { body, headers, sourceKind };
    }

    if (intent === 'apply') {
      body = { ...body, applicationContext };
      if (inlineRetryPayloadRef.current) {
        inlineRetryPayloadRef.current = {
          ...inlineRetryPayloadRef.current,
          body,
        };
      }
    }

    // Stable generationRunId for durable recovery — reuse on retry, never mint twice.
    if (!body.generationRunId?.trim()) {
      body = { ...body, generationRunId: mintGenerationRunId() };
      if (inlineRetryPayloadRef.current) {
        inlineRetryPayloadRef.current = {
          ...inlineRetryPayloadRef.current,
          body,
        };
      }
    }

    // Begin run BEFORE any await (offline / headers / analyze).
    transformCancelledRef.current = false;
    partialShownRef.current = false;
    streamProgressShared.value = 0;

    const activeMapIdForRun = body.mapId ?? mapId;
    const { snapshot: runSnapshot, signal: runSignal } = transformRunRef.current.begin({
      mapId: activeMapIdForRun,
      sourceId: body.sourceId,
      sourceVersionId: body.sourceVersionId,
      sourceRequestId: body.sourceRequestId,
      textMode: body.textMode === 'ask' ? 'ask' : body.type === 'text' ? 'source' : undefined,
      auth: authSnap
        ? {
            epoch: authSnap.epoch,
            userId: authSnap.userId,
            accessToken: authSnap.accessToken,
          }
        : null,
    });
    const runId = runSnapshot.runId;
    abortControllerRef.current = {
      abort: () => transformRunRef.current.cancel(),
      signal: runSignal,
    } as AbortController;

    const runStillActive = () => {
      const live = activeAuthRef.current.getSnapshot();
      return transformRunRef.current.isCurrentForAuth(
        runId,
        live ? { userId: live.userId } : null
      );
    };

    // First await — interleaved taps during NetInfo leave only the latest run active.
    await NetInfo.fetch();
    if (!runStillActive()) return;

    setError(null);
    setTransformIncomplete(false);
    setAttachMenuOpen(false);
    clearComposerDraft();
    clearDevPreviewTimers();

    if (!isInlineRetry) {
      clearInlineGeneration();
      clearInlineAutoOpen();
      clearInlineReadyTimeout();
      setInlineUserTurn(
        buildInlineUserTurnSnapshot({
          inputText,
          pastedText,
          uploadedFile,
          conversationalMessage: pickInlineConversationalMessage(cloudUserDisplayName),
          kind: 'source',
        })
      );
      setInlineGenerationStatus('generating');
      setInputText('');
      inputTextRef.current = '';
      setPastedText(null);
      setUploadedFile(null);
    } else {
      setInlineGenerationStatus('generating');
    }
    inlineRetryPayloadRef.current = { body, headers, sourceKind };

    headers = await buildLlmRequestHeaders(accessToken);
    if (!runStillActive()) {
      return;
    }
    inlineRetryPayloadRef.current = {
      body,
      headers,
      sourceKind,
    };

    setIsAnalyzingSource(true);
    let collectionPlan: SourceAnalysisResponse | null = null;
    if (!isInlineRetry) {
      try {
        const analysis = await analyzeTransformSource(body, headers, runSignal);
        if (!runStillActive()) return;
        if (analysis.contentKind) {
          body = { ...body, sourceContentKind: analysis.contentKind };
          inlineRetryPayloadRef.current = {
            body,
            headers,
            sourceKind,
          };
        }
        if (analysis.shouldProposeSplit && analysis.partCount >= 2) {
          const choice = await promptCollectionSplit(analysis.partCount);
          if (!runStillActive()) return;
          if (choice === 'split') {
            collectionPlan = analysis;
          } else {
            body = { ...body, singleNucleoMode: true };
            inlineRetryPayloadRef.current = {
              body,
              headers,
              sourceKind,
            };
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('[analyze] failed', err);
      } finally {
        if (runStillActive()) {
          setIsAnalyzingSource(false);
        }
      }
    } else {
      setIsAnalyzingSource(false);
    }

    resetStreamGenerationUi();
    bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[0]);
    setStreamLoadPhase(0);
    streamProgressShared.value = STREAM_PROGRESS_MILESTONES[0];

    const controller = { signal: runSignal } as AbortController;
    let hasShownPartial = false;
    const activeMapId = body.mapId ?? mapId;
    layer0EarlyOpenRef.current = false;
    let latestSourceMeta: PastedTextSourceMeta | PdfSourceMeta | undefined;
    let latestPdfPersistRetry: PdfPersistRetryPayload | null = null;

    const applySourceMeta = (
      meta: PastedTextSourceMeta | PdfSourceMeta,
      pdfPersistRetry?: PdfPersistRetryPayload | null
    ) => {
      if (!runStillActive()) return;
      const pdfParsed = parsePdfSourceMeta(meta);
      const pastedParsed = pdfParsed ? null : parsePastedTextSourceMeta(meta);
      const parsed = pdfParsed ?? pastedParsed ?? meta;
      latestSourceMeta = parsed;
      if (pdfPersistRetry) latestPdfPersistRetry = pdfPersistRetry;
      const store = updateEntrySourceMeta(historyStoreRef.current, activeMapId, parsed);
      commitHistoryStore(store);
      const ownerId = authSnap?.userId;
      if (
        (pdfParsed?.persistStatus === 'sync_failed' ||
          pastedParsed?.persistStatus === 'sync_failed') &&
        ownerId
      ) {
        const code = sanitizePersistFailureCode(
          (pdfParsed?.persistFailureCode ||
            pastedParsed?.persistFailureCode ||
            'PDF_PERSIST_FAILED') as string
        );
        recordSyncFailure({
          status: 'failed',
          kind: 'source',
          ownerId,
          mapId: activeMapId,
          code,
        });
      } else if (
        (pdfParsed?.persistStatus === 'cloud' ||
          pastedParsed?.persistStatus === 'cloud') &&
        ownerId
      ) {
        clearSyncFailureFor(ownerId, activeMapId, 'source');
      }
      if (
        pdfParsed &&
        pdfParsed.persistStatus === 'sync_failed' &&
        ownerId &&
        typeof body.fileData === 'string' &&
        body.fileData &&
        (pdfPersistRetry || latestPdfPersistRetry)
      ) {
        const retry = pdfPersistRetry || latestPdfPersistRetry!;
        const capturedOwner = ownerId;
        const capturedMapId = activeMapId;
        const fileData = body.fileData;
        void (async () => {
          ensureMobilePendingPdfFileIO();
          let bytes: Uint8Array;
          try {
            const binary =
              typeof globalThis.atob === 'function'
                ? globalThis.atob(fileData)
                : Buffer.from(fileData, 'base64').toString('binary');
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          } catch {
            if (runStillActive()) {
              setError('No se pudo guardar la fuente pendiente en el dispositivo.');
            }
            return;
          }
          const committed = await commitPendingPdfSourceSync({
            userId: capturedOwner,
            liveUserId: () => activeAuthRef.current.getSnapshot()?.userId,
            bytes,
            item: {
              mapId: capturedMapId,
              sourceId: pdfParsed.sourceId,
              sourceVersionId: pdfParsed.sourceVersionId,
              sourceRequestId: pdfParsed.sourceRequestId,
              contentHash: pdfParsed.contentHash,
              extractionDigest: pdfParsed.extractionDigest,
              pageCount: pdfParsed.pageCount,
              segments: retry.segments,
              coverage: retry.coverage,
              storagePath: retry.storagePath || pdfParsed.storagePath,
              title: body.sourceLabel,
            },
          });
          if (committed.ok === false) {
            if (runStillActive()) {
              setError('No se pudo guardar la fuente pendiente en el dispositivo.');
            }
            return;
          }
          if (!runStillActive()) return;
          setPendingSyncByMapId((prev) => ({
            ...prev,
            [capturedMapId]: {
              mapId: capturedMapId,
              sourceId: pdfParsed.sourceId,
              sourceVersionId: pdfParsed.sourceVersionId,
              sourceRequestId: pdfParsed.sourceRequestId,
              canonicalText: '',
              contentHash: pdfParsed.contentHash,
              title: body.sourceLabel,
              updatedAt: Date.now(),
            },
          }));
          // Banner via deriveSyncNotice from pendingSyncByMapId — no setError race.
        })();
      } else if (
        !pdfParsed &&
        pastedParsed &&
        pastedParsed.persistStatus === 'sync_failed' &&
        ownerId &&
        body.text
      ) {
        const item = {
          mapId: activeMapId,
          sourceId: pastedParsed.sourceId,
          sourceVersionId: pastedParsed.sourceVersionId,
          sourceRequestId: pastedParsed.sourceRequestId,
          canonicalText: body.text,
          contentHash: pastedParsed.contentHash,
          title: body.sourceLabel,
        };
        upsertPendingSourceSync(ownerId, item);
        setPendingSyncByMapId((prev) => ({
          ...prev,
          [activeMapId]: { ...item, updatedAt: Date.now() },
        }));
        // Banner via deriveSyncNotice — no setError race with evidence.
        } else if (parsed.persistStatus === 'cloud' && ownerId) {
        removePendingSourceSync(ownerId, parsed.sourceRequestId);
        void (async () => {
          const removed = await removePendingPdfSourceSync(
            ownerId,
            parsed.sourceRequestId
          );
          if (removed.ok === false) {
            setSyncFailure({
              ownerId,
              mapId: activeMapId,
              kind: 'source',
              code: 'PDF_PENDING_REMOVE_FAILED',
            });
            return;
          }
          setPendingSyncByMapId((prev) => {
            const next = { ...prev };
            delete next[activeMapId];
            return next;
          });
        })();
      }
    };

    try {
      if (collectionPlan) {
        if (!runStillActive()) return;
        setIsStreamGenerating(true);
        setCollectionGenerationProgress({
          completed: 0,
          total: collectionPlan.parts.length,
        });
        const collectionId = generateMapId();
        const partIdentities = mintStableCollectionPartIdentities(collectionPlan.parts.length);
        let store = createCollection(historyStoreRef.current, {
          id: collectionId,
          title: collectionPlan.collectionTitle,
        });
        if (!runStillActive()) return;
        commitHistoryStore(store);

        const generatedIds: string[] = [];
        const partTimeoutMs = resolveTransformFallbackTimeoutMs(
          (body.depth as 'rapido' | 'estandar' | 'profundo' | undefined) ?? depthPreference
        );
        const failedParts: string[] = [];
        const COLLECTION_PART_RETRIES = 3;

        for (let index = 0; index < collectionPlan.parts.length; index += 1) {
          if (!runStillActive()) return;

          const part = collectionPlan.parts[index];
          const partIds = partIdentities[index]!;
          if (!runStillActive()) return;
          setCollectionGenerationProgress({
            completed: generatedIds.length,
            total: collectionPlan.parts.length,
          });
          streamProgressShared.value = Math.round(
            (generatedIds.length / Math.max(collectionPlan.parts.length, 1)) * 100
          );

          const partBody = buildStableCollectionPartBody(body, part, partIds);
          let partOk = false;
          let lastPartError: unknown = null;

          for (let attempt = 1; attempt <= COLLECTION_PART_RETRIES; attempt += 1) {
            if (!runStillActive()) return;
            try {
              const response = await fetchWithTimeout(
                apiUrl('/api/transform'),
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(headers ?? {}),
                  },
                  body: JSON.stringify(partBody),
                  signal: runSignal,
                },
                {
                  timeoutMs: partTimeoutMs,
                  timeoutMessage:
                    'Este Núcleo de la colección está tardando demasiado. Se reintenta o se continúa con el resto.',
                }
              );
              if (!runStillActive()) return;

              const rawJson = await response.json().catch(() => ({}));
              if (!runStillActive()) return;

              if (!response.ok) {
                const payload = rawJson as {
                  error?: string;
                  code?: string;
                  action?: string;
                };
                if (response.status === 402 || payload.code === 'quota_exceeded') {
                  const quotaError = new Error(payload.error || 'Límite beta alcanzado');
                  (quotaError as Error & { code?: string }).code = 'quota_exceeded';
                  throw quotaError;
                }
                throw new Error(payload.error || GENERIC_TRANSFORM_ERROR);
              }

              const { mapPayload, sourceMeta: partMeta } = splitTransformJsonPayload(rawJson);
              const normalizedRaw = normalizeMapData(mapPayload);
              const normalized =
                partBody.generationMode === 'study-doc-beta' && normalizedRaw
                  ? applyStudyDocBetaClientShape(normalizedRaw)
                  : normalizedRaw;
              if (!normalized) {
                throw new Error(GENERIC_TRANSFORM_ERROR);
              }
              const partMap = withPersistedSourceFormat(normalized, body);
              if (!runStillActive()) return;
              store = createEntry(
                store,
                { data: partMap, currentStep: 0, isComplete: false, viewAll: false },
                historySourceTypeForRequest(body),
                partIds.mapId,
                collectionId,
                partMeta ?? undefined
              );
              store = registerNucleoInCollection(store, collectionId, partIds.mapId);
              if (partMeta) {
                store = updateEntrySourceMeta(store, partIds.mapId, partMeta);
                if (partMeta.persistStatus === 'sync_failed' && authSnap?.userId) {
                  upsertPendingSourceSync(authSnap.userId, {
                    mapId: partIds.mapId,
                    sourceId: partMeta.sourceId,
                    sourceVersionId: partMeta.sourceVersionId,
                    sourceRequestId: partMeta.sourceRequestId,
                    canonicalText: partBody.text || '',
                    contentHash: partMeta.contentHash,
                    title: partBody.sourceLabel,
                    collectionId,
                  });
                  setPendingSyncByMapId((prev) => ({
                    ...prev,
                    [partIds.mapId]: {
                      mapId: partIds.mapId,
                      sourceId: partMeta.sourceId,
                      sourceVersionId: partMeta.sourceVersionId,
                      sourceRequestId: partMeta.sourceRequestId,
                      canonicalText: partBody.text || '',
                      contentHash: partMeta.contentHash,
                      title: partBody.sourceLabel,
                      collectionId,
                      updatedAt: Date.now(),
                    },
                  }));
                }
              }
              if (!runStillActive()) return;
              commitHistoryStore(store);

              const createdEntry = store.entries.find((item) => item.id === partIds.mapId);
              if (createdEntry) {
                if (!runStillActive()) return;
                syncCloudEntry(createdEntry);
              }
              generatedIds.push(partIds.mapId);
              partOk = true;
              break;
            } catch (partErr) {
              if (isBetaQuotaExceededError(partErr)) {
                throw partErr;
              }
              if (partErr instanceof Error && partErr.name === 'AbortError') {
                if (!runStillActive()) return;
              }
              lastPartError = partErr;
              const willRetry =
                attempt < COLLECTION_PART_RETRIES && isTransientNetworkError(partErr);
              const partLabel = `[collection] part ${index + 1}/${collectionPlan.parts.length} attempt ${attempt}/${COLLECTION_PART_RETRIES} failed`;
              if (willRetry) {
                console.warn(`${partLabel}; retrying`, partErr);
                await sleepMs(1500 * attempt);
                if (!runStillActive()) return;
                continue;
              }
              console.error(partLabel, partErr);
              break;
            }
          }

          if (!partOk) {
            failedParts.push(part.title || `Parte ${index + 1}`);
            console.error(
              `[collection] part ${index + 1}/${collectionPlan.parts.length} gave up`,
              lastPartError
            );
          }
        }

        if (!runStillActive()) return;

        if (generatedIds.length === 0) {
          throw new Error(
            failedParts.length > 0
              ? `No se pudo generar ningún Núcleo de la colección (${failedParts[0]}).`
              : GENERIC_TRANSFORM_ERROR
          );
        }

        if (!runStillActive()) return;
        setCollectionGenerationProgress({
          completed: generatedIds.length,
          total: collectionPlan.parts.length,
        });
        streamProgressShared.value = 100;
        setIsStreamGenerating(false);

        const firstId = generatedIds[0];
        if (!runStillActive()) return;
        store = setActiveId(store, firstId);
        commitHistoryStore(store);
        const firstEntry = getActiveEntry(store);
        if (!firstEntry) {
          throw new Error(GENERIC_TRANSFORM_ERROR);
        }

        if (!runStillActive()) return;
        const firstMap = normalizeMapData(firstEntry.session.data);
        setData(firstMap);
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setUploadedFile(null);
        setPastedText(null);
        setInputText('');
        inputTextRef.current = '';
        setCollectionGenerationProgress(null);
        clearInlineGeneration();
        resetStreamGenerationUi();
        setPhase('result');
        setTransformIncomplete(false);
        if (failedParts.length > 0) {
          setError(
            `Se generaron ${generatedIds.length} de ${collectionPlan.parts.length} Núcleos. Fallaron: ${failedParts.slice(0, 3).join(', ')}${failedParts.length > 3 ? '…' : ''}.`
          );
        }
        hapticSuccess();
        return;
      }

      setIsStreamGenerating(true);

      const markInlineReady = () => {
        if (!runStillActive()) return;
        lastSubmittedFileRef.current = null;
        const status = inlineGenerationStatusRef.current;
        if (status !== 'generating' && status !== 'partial') {
          streamTrace(
            'app_status',
            {
              runId,
              mapId: activeMapId,
              status: `ready_rejected:${status}`,
            },
            'error'
          );
          return;
        }

        // The request run is cleared as soon as fetchTransformWithProgress returns.
        // Deferring this transition made the timeout see a stale run and silently
        // leave a completed Núcleo behind the infinite generating state. The thread
        // already owns the visual completion choreography, so publish readiness now.
        setInlineGenerationStatus('ready');
        trackProductEvent('transform_success');
        streamTrace('app_status', {
          runId,
          mapId: activeMapId,
          status: 'ready',
        });
      };

      const completedMapKeyRef = { current: false as boolean };

      const saveCompletedMap = (normalized: ActionMapData) => {
        const readableMap = preferUnderstandingWhenApplicationNeedsContext(normalized);
        let finalMap =
          body.generationMode === 'study-doc-beta'
            ? applyStudyDocBetaClientShape(readableMap)
            : body.generationMode === 'visualize-html-test'
              ? { ...readableMap, generationMode: 'visualize-html-test' as const }
              : readableMap;
        finalMap = withPersistedSourceFormat(finalMap, body);
        finalMap = withPersistedSourceUrl(finalMap, body);
        if (body.generationMode === 'visualize-html-test') {
          finalMap = {
            ...finalMap,
            visualizeArtifact: ensureVisualizeArtifact(finalMap.visualizeArtifact, {
              coreIdea: finalMap.coreIdea,
              tldr: finalMap.tldr,
              visualization: finalMap.visualization,
            }),
          };
        }
        const session = {
          data: finalMap,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
          layer0Passed: layer0EarlyOpenRef.current ? layer0PassedRef.current : false,
          layer0CheckedActionIds: layer0EarlyOpenRef.current
            ? layer0CheckedActionIdsRef.current
            : ([] as string[]),
        };

        const currentStore = historyStoreRef.current;
        const existing = currentStore.entries.find((item) => item.id === activeMapId);
        let updatedStore;
        if (existing) {
          const entries = currentStore.entries.map((item) =>
            item.id === activeMapId
              ? {
                  ...item,
                  title: finalMap.title || item.title,
                  session: {
                    ...item.session,
                    ...session,
                    layer0Passed: layer0EarlyOpenRef.current
                      ? layer0PassedRef.current
                      : item.session.layer0Passed ?? false,
                    layer0CheckedActionIds: layer0EarlyOpenRef.current
                      ? layer0CheckedActionIdsRef.current
                      : item.session.layer0CheckedActionIds ?? [],
                  },
                  updatedAt: Date.now(),
                }
              : item
          );
          updatedStore = setActiveId({ ...currentStore, entries }, activeMapId);
        } else {
          updatedStore = createEntry(
            currentStore,
            session,
            historySourceTypeForRequest(body),
            activeMapId,
            undefined,
            latestSourceMeta
          );
        }
        if (latestSourceMeta) {
          updatedStore = updateEntrySourceMeta(updatedStore, activeMapId, latestSourceMeta);
        }
        commitHistoryStore(updatedStore);

        const createdEntry = updatedStore.entries.find((item) => item.id === activeMapId);
        if (createdEntry) {
          syncCloudEntry(createdEntry);
          void ensureNucleoCover(createdEntry, applyGeneratedCover);
        }

        setData(finalMap);
        if (!layer0EarlyOpenRef.current) {
          setCurrentStep(0);
          setIsComplete(false);
          setViewAll(false);
          setLayer0Passed(false);
          setLayer0CheckedActionIds([]);
        }
        inlineResultEntryIdRef.current = activeMapId;
        setTransformIncomplete(false);
      };

      /** Single idempotent finisher — stream done OR durable poll recovery. */
      const completeTransformRun = (finalMap: ActionMapData) => {
        if (completedMapKeyRef.current) {
          streamTrace('app_status', {
            runId,
            mapId: activeMapId,
            status: 'complete_ignored_duplicate',
          });
          return;
        }
        if (!runStillActive()) {
          streamTrace('app_status', {
            runId,
            mapId: activeMapId,
            status: 'complete_ignored_stale',
          });
          return;
        }
        bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[4]);
        streamProgressShared.value = STREAM_PROGRESS_MILESTONES[4];
        saveCompletedMap(finalMap);
        completedMapKeyRef.current = true;

        setIsStreamGenerating(false);
        clearInlineAutoOpen();
        clearInlineReadyTimeout();

        if (layer0EarlyOpenRef.current) {
          // Result already visible (partial) — land on ready without clearing mid-flight earlier.
          setInlineGenerationStatus('ready');
          streamTrace('app_status', {
            runId,
            mapId: activeMapId,
            status: 'partial_to_ready',
          });
          return;
        }

        markInlineReady();
        streamTrace('app_status', {
          runId,
          mapId: activeMapId,
          status: 'generating_to_ready',
        });
      };

      const applyPartialMap = (partialMap: ActionMapData) => {
        let displayMap =
          body.generationMode === 'study-doc-beta'
            ? applyStudyDocBetaClientShape(partialMap)
            : body.generationMode === 'visualize-html-test'
              ? { ...partialMap, generationMode: 'visualize-html-test' as const }
              : partialMap;
        displayMap = withPersistedSourceUrl(displayMap, body);
        if (body.generationMode === 'visualize-html-test') {
          displayMap = {
            ...displayMap,
            visualizeArtifact: ensureVisualizeArtifact(displayMap.visualizeArtifact, {
              coreIdea: displayMap.coreIdea,
              tldr: displayMap.tldr,
              visualization: displayMap.visualization,
            }),
          };
        }
        setData(displayMap);
        setStreamLoadPhase(resolveStreamLoadPhase(displayMap));

        // Open Capa 0 as soon as it arrives — Capa 1 keeps streaming behind.
        if (
          !collectionPlan &&
          !layer0EarlyOpenRef.current &&
          isLayer0Complete(displayMap.layer0) &&
          (inlineGenerationStatusRef.current === 'generating' ||
            inlineGenerationStatusRef.current === 'partial')
        ) {
          layer0EarlyOpenRef.current = true;
          const draftSession = {
            data: displayMap,
            currentStep: 0,
            isComplete: false,
            viewAll: false,
            layer0Passed: false,
            layer0CheckedActionIds: [] as string[],
          };
          const currentStore = historyStoreRef.current;
          const existing = currentStore.entries.find((item) => item.id === activeMapId);
          if (existing) {
            const entries = currentStore.entries.map((item) =>
              item.id === activeMapId
                ? { ...item, title: displayMap.title || item.title, session: draftSession, updatedAt: Date.now() }
                : item
            );
            commitHistoryStore(setActiveId({ ...currentStore, entries }, activeMapId));
          } else {
            commitHistoryStore(
              createEntry(
                currentStore,
                draftSession,
                historySourceTypeForRequest(body),
                activeMapId
              )
            );
          }
          inlineResultEntryIdRef.current = activeMapId;
          setLayer0Passed(false);
          setLayer0CheckedActionIds([]);
          setCurrentStep(0);
          setIsComplete(false);
          setViewAll(false);
          clearInlineAutoOpen();
          clearInlineReadyTimeout();
          // generating → partial; never idle while isStreamGenerating.
          setInlineGenerationStatus('partial');
          hasShownPartial = true;
          partialShownRef.current = true;
          setPhase('result');
          hapticSuccess();
          streamTrace('app_status', {
            runId,
            mapId: activeMapId,
            status: 'generating_to_partial',
          });
        }

        const pageLabel = displayMap.sourceMetadata?.label?.trim();
        const pageTitle = displayMap.title?.trim();
        const resolvedTitle =
          pageLabel && !/^https?:\/\//i.test(pageLabel)
            ? pageLabel
            : pageTitle || null;
        if (resolvedTitle) {
          setInlineUserTurn((current) => {
            if (!current || (!current.urlKind && current.attachments.length === 0)) return current;
            if (current.urlKind !== 'link' && current.urlKind !== 'youtube') return current;
            if (current.linkTitle === resolvedTitle) return current;
            return { ...current, linkTitle: resolvedTitle };
          });
        }

        if (displayMap.coreIdea?.trim()) {
          bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[2]);
        }
        if ((displayMap.steps?.length ?? 0) > 0) {
          bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[3]);
        }
      };

      await fetchTransformWithProgress({
        streamUrl: apiUrl('/api/transform/stream'),
        fallbackUrl: apiUrl('/api/transform'),
        body,
        headers,
        signal: controller.signal,
        depth: depthPreference,
        handlers: {
          onFirstStreamByte: () => {
            if (!runStillActive()) return;
            bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[1]);
          },
          onPartial: (partialMap) => {
            if (!runStillActive()) return;
            hasShownPartial = true;
            partialShownRef.current = true;
            applyPartialMap(partialMap);
          },
          onEssentialReady: (partialMap) => {
            if (!runStillActive()) return;
            hasShownPartial = true;
            partialShownRef.current = true;
            applyPartialMap(partialMap);
            bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[2]);
          },
          onStage: (label) => {
            if (!runStillActive()) return;
            if (/esencial/i.test(label)) {
              bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[2]);
            } else if (/Conectando|ideas/i.test(label)) {
              bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[3]);
            } else if (/Terminando/i.test(label)) {
              bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[3]);
            } else {
              bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[1]);
            }
          },
          onHeartbeat: () => {
            streamTrace('heartbeat', { runId, mapId: activeMapId });
          },
          onRun: (ids) => {
            streamTrace('event_received', {
              runId,
              mapId: ids.mapId,
              generationRunId: ids.generationRunId,
              eventType: 'run',
            });
          },
          onSourceMeta: (meta, pdfPersistRetry) => {
            applySourceMeta(meta, pdfPersistRetry);
          },
          onDone: (finalMap, _model, meta, pdfPersistRetry) => {
            if (meta) applySourceMeta(meta, pdfPersistRetry);
            completeTransformRun(finalMap);
          },
          onAsk: (askResult) => {
            if (!runStillActive()) return;
            setIsStreamGenerating(false);
            setIsAnalyzingSource(false);
            setCollectionGenerationProgress(null);
            setInlineUserTurn(
              buildInlineUserTurnSnapshot({
                inputText: bodyText || body.text || '',
                pastedText: null,
                uploadedFile: null,
                conversationalMessage: '',
                kind: 'ask',
              })
            );
            setInlineAskAnswer(askResult.answer.trim());
            setInlineAskDisclaimer(null);
            setInlineAskCtaLabel(null);
            setInlineAskModelUsed(askResult.modelUsed?.trim() || null);
            const savedId = persistAskChat({
              question: bodyText || body.text || '',
              answer: askResult.answer.trim(),
              title: askResult.title,
              modelUsed: askResult.modelUsed,
            });
            if (savedId) setInlineAskChatId(savedId);
            setInlineGenerationStatus('ready');
            setPhase('input');
            hapticSuccess();
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (transformCancelledRef.current) {
          setIsStreamGenerating(false);
          setInlineGenerationStatus('cancelled');
          setError(null);
          setPhase('input');
          return;
        }
        failTransform(TRANSFORM_IDLE_TIMEOUT_MESSAGE, hasShownPartial, sourceKind);
        return;
      }

      if (isBetaQuotaExceededError(err)) {
        failTransform(
          err instanceof Error ? err.message : 'Límite beta alcanzado',
          false,
          sourceKind
        );
        return;
      }

      if (err instanceof TransformHttpError) {
        if (err.status === 501 || err.code === 'FEATURE_DISABLED') {
          if (lastSubmittedFileRef.current) {
            setUploadedFile(lastSubmittedFileRef.current);
          }
          setError(EXPANDED_INPUTS_DISABLED_MESSAGE);
          setTransformIncomplete(false);
          setInlineGenerationStatus('error');
          setPhase('input');
          hapticError();
          return;
        }
        if (err.status === 413 || err.code === 'FILE_TOO_LARGE') {
          lastSubmittedFileRef.current = null;
          setUploadedFile(null);
          setError(FILE_TOO_LARGE_MESSAGE);
          setTransformIncomplete(false);
          setInlineGenerationStatus('error');
          setPhase('input');
          hapticError();
          return;
        }
      }

      const rawMessage =
        err instanceof Error ? err.message : 'No se pudo procesar el contenido.';
      const offline = await isDeviceOffline();
      failTransform(
        messageAfterFailedRequest(err, offline, rawMessage),
        hasShownPartial,
        sourceKind,
        offline
      );
    } finally {
      setIsStreamGenerating(false);
      setCollectionGenerationProgress(null);
      abortControllerRef.current = null;
      transformRunRef.current.clearIf(runId);
    }
  }, [
    bumpStreamProgressCap,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineGeneration,
    clearInlineReadyTimeout,
    commitHistoryStore,
    cloudUserDisplayName,
    depthPreference,
    failTransform,
    generationMode,
    inputText,
    intent,
    modelPreference,
    pastedText,
    persistAskChat,
    resetStreamGenerationUi,
    syncCloudEntry,
    uploadedFile,
  ]);

  const isSourcePendingForMap = useCallback((userId: string, mapId: string) => {
    // Durable store only — React pendingSyncByMapId can lag one tick after success
    // and would incorrectly block the evidence step in the same ordered pass.
    return Boolean(
      getPendingPdfSourceSyncForMap(userId, mapId) ||
        getPendingSourceSyncForMap(userId, mapId)
    );
  }, []);

  const clearSyncErrorStrings = useCallback(() => {
    setError((current) =>
      current === pastedTextUiMessage('sync_pending') ||
      current === EVIDENCE_SYNC_PENDING_MESSAGE ||
      current === 'Inicia sesión para sincronizar la evidencia.' ||
      current === 'Inicia sesión para sincronizar la fuente.'
        ? null
        : current
    );
  }, []);

  const handlePersistEvidenceSync = useCallback(async (mapIdArg?: string): Promise<PersistStepResult> => {
    const empty = (status: PersistStepResult['status'], code?: string | null, ownerId = '', mapId = ''): PersistStepResult => ({
      status,
      kind: 'evidence',
      ownerId,
      mapId,
      code: code ?? null,
    });
    if (inlineGenerationStatusRef.current === 'generating' || inlineGenerationStatusRef.current === 'partial' || isStreamGenerating) {
      return empty('cancelled', 'EVIDENCE_GENERATING');
    }
    const authSnap = activeAuthRef.current.getSnapshot();
    if (!authSnap?.accessToken || !authSnap.userId) {
      const failed = empty('failed', 'EVIDENCE_AUTH_REQUIRED');
      recordSyncFailure(failed);
      return failed;
    }
    const mapId =
      mapIdArg ||
      inlineResultEntryIdRef.current ||
      historyStoreRef.current.activeId ||
      '';
    if (!mapId) {
      const failed = empty('failed', 'EVIDENCE_NO_MAP', authSnap.userId);
      recordSyncFailure(failed);
      return failed;
    }

    const gate = persistRetryGateRef.current;
    if (!gate.tryBeginManual(authSnap.userId, mapId, 'evidence')) {
      return empty('busy', 'EVIDENCE_BUSY', authSnap.userId, mapId);
    }

    setEvidenceSaving({ ownerId: authSnap.userId, mapId });
    try {
      const sourcePending = isSourcePendingForMap(authSnap.userId, mapId);
      const pending =
        getPendingEvidenceSyncForMap(authSnap.userId, mapId) ||
        pendingEvidenceSyncByMapId[mapId] ||
        null;
      if (!pending && !pendingEvidenceSyncByMapId[mapId]) {
        const still = getPendingEvidenceSyncForMap(authSnap.userId, mapId);
        if (!still) {
          return empty('not_pending', null, authSnap.userId, mapId);
        }
      }
      const entry = historyStoreRef.current.entries.find((e) => e.id === mapId);
      const data = entry?.session?.data as ActionMapData | undefined;
      const evidence = data?.evidence as EvidenceArtifact | undefined;
      if (!evidence || evidence.status !== 'complete') {
        removePendingEvidenceSync(authSnap.userId, mapId);
        setPendingEvidenceSyncByMapId((prev) => {
          if (!prev[mapId]) return prev;
          const next = { ...prev };
          delete next[mapId];
          return next;
        });
        clearSyncFailureFor(authSnap.userId, mapId, 'evidence');
        return empty('not_pending', null, authSnap.userId, mapId);
      }

      const sourceId = pending?.sourceId || entry?.sourceMeta?.sourceId;
      const sourceVersionId =
        pending?.sourceVersionId || entry?.sourceMeta?.sourceVersionId;
      const flushGate = canFlushEvidence({
        sourcePending,
        evidencePending: true,
        sourceId,
        sourceVersionId,
      });
      if (!flushGate.ok) {
        // WAITING_SOURCE / UNBOUND are coordination — do not overwrite SOURCE/PDF codes.
        return empty(
          flushGate.code === 'EVIDENCE_WAITING_SOURCE' ? 'blocked' : 'failed',
          flushGate.code,
          authSnap.userId,
          mapId
        );
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!supabaseUrl || !anonKey) {
        const failed = empty(
          'failed',
          'EVIDENCE_SUPABASE_UNCONFIGURED',
          authSnap.userId,
          mapId
        );
        recordSyncFailure(failed);
        return failed;
      }

      const startedUserId = authSnap.userId;
      const epoch = authSnap.epoch;
      const result = await flushPendingEvidenceSync({
        userId: authSnap.userId,
        mapId,
        evidence,
        sourceId,
        sourceVersionId,
        contentHash:
          pending?.contentHash ||
          entry?.sourceMeta?.contentHash ||
          data?.understanding?.contentHash,
        accessToken: authSnap.accessToken,
        supabaseUrl,
        supabaseAnonKey: anonKey,
        isCurrent: () => activeAuthRef.current.isCurrent(epoch, startedUserId),
      });

      if (!activeAuthRef.current.isCurrent(epoch, startedUserId)) {
        return empty('stale', 'EVIDENCE_AUTH_STALE', startedUserId, mapId);
      }

      if (result.ok === true) {
        setPendingEvidenceSyncByMapId((prev) => {
          if (!prev[mapId]) return prev;
          const next = { ...prev };
          delete next[mapId];
          return next;
        });
        setEvidenceCloudConfirmedByMapId((prev) => ({ ...prev, [mapId]: true }));
        clearSyncFailureFor(startedUserId, mapId, 'evidence');
        clearSyncErrorStrings();
        return empty('success', null, startedUserId, mapId);
      }

      if (result.ok === false && result.code === 'EVIDENCE_AUTH_STALE') {
        return empty('stale', 'EVIDENCE_AUTH_STALE', startedUserId, mapId);
      }
      if (result.ok === false) {
        upsertPendingEvidenceSync(startedUserId, {
          mapId,
          sourceId,
          sourceVersionId,
          contentHash: pending?.contentHash || entry?.sourceMeta?.contentHash,
        });
        setPendingEvidenceSyncByMapId(pendingEvidenceSyncIndexByMapId(startedUserId));
        const failed = empty(
          'failed',
          result.code || 'EVIDENCE_PERSIST_FAILED',
          startedUserId,
          mapId
        );
        recordSyncFailure(failed);
        clearSyncErrorStrings();
        return failed;
      }
      return empty('failed', 'EVIDENCE_PERSIST_FAILED', startedUserId, mapId);
    } finally {
      gate.end(authSnap.userId, mapId, 'evidence');
      setEvidenceSaving((current) =>
        current && current.ownerId === authSnap.userId && current.mapId === mapId
          ? null
          : current
      );
    }
  }, [
    clearSyncErrorStrings,
    clearSyncFailureFor,
    isSourcePendingForMap,
    isStreamGenerating,
    pendingEvidenceSyncByMapId,
    recordSyncFailure,
  ]);

  const handlePersistSourceSync = useCallback(async (mapIdArg?: string): Promise<PersistStepResult> => {
    const empty = (status: PersistStepResult['status'], code?: string | null, ownerId = '', mapId = ''): PersistStepResult => ({
      status,
      kind: 'source',
      ownerId,
      mapId,
      code: code ?? null,
    });
    if (inlineGenerationStatusRef.current === 'generating' || inlineGenerationStatusRef.current === 'partial' || isStreamGenerating) {
      return empty('cancelled', 'SOURCE_GENERATING');
    }
    const authSnap = activeAuthRef.current.getSnapshot();
    if (!authSnap?.accessToken || !authSnap.userId) {
      const failed = empty('failed', 'SOURCE_AUTH_REQUIRED');
      recordSyncFailure(failed);
      return failed;
    }

    const mapId =
      mapIdArg ||
      inlineResultEntryIdRef.current ||
      historyStoreRef.current.activeId ||
      inlineRetryPayloadRef.current?.body.mapId ||
      '';
    if (!mapId) {
      const failed = empty('failed', 'SOURCE_NO_MAP', authSnap.userId);
      recordSyncFailure(failed);
      return failed;
    }

    const gate = persistRetryGateRef.current;
    if (!gate.tryBeginManual(authSnap.userId, mapId, 'source')) {
      return empty('busy', 'SOURCE_BUSY', authSnap.userId, mapId);
    }

    setSourceSaving({ ownerId: authSnap.userId, mapId });
    const startedUserId = authSnap.userId;

    try {
      const pdfPending = getPendingPdfSourceSyncForMap(authSnap.userId, mapId);
      if (pdfPending) {
        persistSyncAbortRef.current?.abort();
        const abort = new AbortController();
        persistSyncAbortRef.current = abort;
        try {
          ensureMobilePendingPdfFileIO();
          const headers = await buildLlmRequestHeaders(authSnap.accessToken);
          const live = activeAuthRef.current.getSnapshot();
          if (!live || live.userId !== startedUserId || abort.signal.aborted) {
            return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
          }

          const file = await readPendingPdfFile(pdfPending.localFileUri);
          if (!file.ok) {
            const failed = empty('failed', 'PDF_LOCAL_READ_FAILED', startedUserId, mapId);
            recordSyncFailure(failed);
            return failed;
          }
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < file.bytes.length; i += chunk) {
            binary += String.fromCharCode(...file.bytes.subarray(i, i + chunk));
          }
          const fileData =
            typeof globalThis.btoa === 'function'
              ? globalThis.btoa(binary)
              : Buffer.from(file.bytes).toString('base64');

          const response = await fetch(apiUrl('/api/sources/pdf/persist'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({
              fileData,
              title: pdfPending.title,
              mapId: pdfPending.mapId,
              sourceId: pdfPending.sourceId,
              sourceVersionId: pdfPending.sourceVersionId,
              sourceRequestId: pdfPending.sourceRequestId,
              contentHash: pdfPending.contentHash,
              extractionDigest: pdfPending.extractionDigest,
              pageCount: pdfPending.pageCount,
              segments: pdfPending.segments,
              coverage: pdfPending.coverage,
              storagePath: pdfPending.storagePath,
            }),
            signal: abort.signal,
          });
          if (abort.signal.aborted) {
            return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
          }
          const liveAfter = activeAuthRef.current.getSnapshot();
          if (!liveAfter || liveAfter.userId !== startedUserId) {
            return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
          }

          const parsed = (await response.json()) as {
            ok?: boolean;
            sourceMeta?: PdfSourceMeta;
            error?: string;
            code?: string;
          };
          if (abort.signal.aborted) {
            return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
          }
          const still = activeAuthRef.current.getSnapshot();
          if (!still || still.userId !== startedUserId) {
            return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
          }

          const meta = parsePdfSourceMeta(parsed.sourceMeta);
          if (!response.ok || !meta) {
            const failed = empty(
              'failed',
              parsed.code ||
                (typeof parsed.error === 'string' && parsed.error
                  ? `PDF_PERSIST_HTTP_${response.status}`
                  : `PDF_PERSIST_FAILED_${response.status}`),
              startedUserId,
              mapId
            );
            recordSyncFailure(failed);
            clearSyncErrorStrings();
            return failed;
          }
          commitHistoryStore(
            updateEntrySourceMeta(historyStoreRef.current, pdfPending.mapId, meta)
          );
          if (meta.persistStatus === 'cloud') {
            const removed = await removePendingPdfSourceSync(
              startedUserId,
              pdfPending.sourceRequestId
            );
            if (removed.ok === false) {
              const failed = empty(
                'failed',
                'PDF_PENDING_REMOVE_FAILED',
                startedUserId,
                mapId
              );
              recordSyncFailure(failed);
              clearSyncErrorStrings();
              return failed;
            }
            // Durable queue cleared — only then drop visual pending.
            setPendingSyncByMapId((prev) => {
              const next = { ...prev };
              delete next[pdfPending.mapId];
              return next;
            });
            clearSyncFailureFor(startedUserId, mapId, 'source');
            clearSyncErrorStrings();
            return empty('success', null, startedUserId, mapId);
          }
          const failed = empty(
            'failed',
            sanitizePersistFailureCode(
              meta.persistFailureCode || 'PDF_PERSIST_NOT_CLOUD'
            ),
            startedUserId,
            mapId
          );
          recordSyncFailure(failed);
          clearSyncErrorStrings();
          return failed;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
          }
          const still = activeAuthRef.current.getSnapshot();
          if (!still || still.userId !== startedUserId) {
            return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
          }
          const failed = empty('failed', 'PDF_PERSIST_NETWORK', startedUserId, mapId);
          recordSyncFailure(failed);
          clearSyncErrorStrings();
          return failed;
        } finally {
          if (persistSyncAbortRef.current === abort) {
            persistSyncAbortRef.current = null;
          }
        }
      }

      if (!isSourcePendingForMap(authSnap.userId, mapId) && !pendingSyncByMapId[mapId]) {
        return empty('not_pending', null, startedUserId, mapId);
      }

      const pending =
        getPendingSourceSyncForMap(authSnap.userId, mapId) ||
        pendingSyncByMapId[mapId] ||
        null;
      const retryBody = inlineRetryPayloadRef.current?.body;
      const ids = {
        mapId,
        sourceId: pending?.sourceId || retryBody?.sourceId || '',
        sourceVersionId: pending?.sourceVersionId || retryBody?.sourceVersionId || '',
        sourceRequestId: pending?.sourceRequestId || retryBody?.sourceRequestId || '',
      };
      const canonicalText = pending?.canonicalText || retryBody?.text || '';
      const title = pending?.title || retryBody?.sourceLabel;
      if (
        !ids.sourceId ||
        !ids.sourceVersionId ||
        !ids.sourceRequestId ||
        !canonicalText
      ) {
        const failed = empty('failed', 'SOURCE_IDS_INCOMPLETE', startedUserId, mapId);
        recordSyncFailure(failed);
        clearSyncErrorStrings();
        return failed;
      }

      persistSyncAbortRef.current?.abort();
      const abort = new AbortController();
      persistSyncAbortRef.current = abort;

      try {
        const headers = await buildLlmRequestHeaders(authSnap.accessToken);
        const live = activeAuthRef.current.getSnapshot();
        if (!live || live.userId !== startedUserId || abort.signal.aborted) {
          return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
        }

        const response = await fetch(apiUrl('/api/sources/pasted/persist'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            text: canonicalText,
            title,
            mapId: ids.mapId,
            sourceId: ids.sourceId,
            sourceVersionId: ids.sourceVersionId,
            sourceRequestId: ids.sourceRequestId,
            textMode: 'source',
          }),
          signal: abort.signal,
        });
        if (abort.signal.aborted) {
          return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
        }
        const liveAfter = activeAuthRef.current.getSnapshot();
        if (!liveAfter || liveAfter.userId !== startedUserId) {
          return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
        }

        const parsed = (await response.json()) as {
          ok?: boolean;
          sourceMeta?: PastedTextSourceMeta;
          error?: string;
          code?: string;
        };
        if (abort.signal.aborted) {
          return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
        }
        const still = activeAuthRef.current.getSnapshot();
        if (!still || still.userId !== startedUserId) {
          return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
        }

        const meta = parsePastedTextSourceMeta(parsed.sourceMeta);
        if (!response.ok || !meta) {
          const failed = empty(
            'failed',
            parsed.code || `SOURCE_PERSIST_HTTP_${response.status}`,
            startedUserId,
            mapId
          );
          recordSyncFailure(failed);
          clearSyncErrorStrings();
          return failed;
        }
        commitHistoryStore(
          updateEntrySourceMeta(historyStoreRef.current, ids.mapId, meta)
        );
        if (meta.persistStatus === 'cloud') {
          removePendingSourceSync(authSnap.userId, ids.sourceRequestId);
          setPendingSyncByMapId((prev) => {
            const next = { ...prev };
            delete next[ids.mapId];
            return next;
          });
          clearSyncFailureFor(startedUserId, mapId, 'source');
          clearSyncErrorStrings();
          return empty('success', null, startedUserId, mapId);
        }
        const failed = empty('failed', 'SOURCE_PERSIST_NOT_CLOUD', startedUserId, mapId);
        recordSyncFailure(failed);
        clearSyncErrorStrings();
        return failed;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return empty('cancelled', 'SOURCE_ABORTED', startedUserId, mapId);
        }
        const still = activeAuthRef.current.getSnapshot();
        if (!still || still.userId !== startedUserId) {
          return empty('stale', 'SOURCE_AUTH_STALE', startedUserId, mapId);
        }
        const failed = empty('failed', 'SOURCE_PERSIST_NETWORK', startedUserId, mapId);
        recordSyncFailure(failed);
        clearSyncErrorStrings();
        return failed;
      } finally {
        if (persistSyncAbortRef.current === abort) {
          persistSyncAbortRef.current = null;
        }
      }
    } finally {
      gate.end(startedUserId, mapId, 'source');
      setSourceSaving((current) =>
        current && current.ownerId === startedUserId && current.mapId === mapId
          ? null
          : current
      );
    }
  }, [
    clearSyncErrorStrings,
    clearSyncFailureFor,
    commitHistoryStore,
    isSourcePendingForMap,
    isStreamGenerating,
    pendingSyncByMapId,
    recordSyncFailure,
  ]);

  const handleOrderedPersistRetry = useCallback(async (mode: 'auto' | 'manual' = 'manual') => {
    if (inlineGenerationStatusRef.current === 'generating' || inlineGenerationStatusRef.current === 'partial' || isStreamGenerating) {
      return;
    }
    const authSnap = activeAuthRef.current.getSnapshot();
    const mapId =
      inlineResultEntryIdRef.current || historyStoreRef.current.activeId || '';
    if (!authSnap?.userId || !mapId) return;

    // Durable queues only — React pending indexes may lag right after hydrate.
    const durable = captureDurableSyncPending(authSnap.userId, mapId);
    if (!hasAnyDurableSyncPending(durable)) return;

    const outcome = await runOrderedPersistSync({
      ownerId: authSnap.userId,
      mapId,
      gate: persistRetryGateRef.current,
      mode,
      sourcePending: durable.sourcePending,
      evidencePending: durable.evidencePending,
      progressPending: durable.progressPending,
      persistSource: () => handlePersistSourceSync(mapId),
      persistEvidence: () => handlePersistEvidenceSync(mapId),
      persistProgress: () => handlePersistProgressSync(mapId),
    });

    if (outcome.firstActionableFailure) {
      recordSyncFailure(outcome.firstActionableFailure);
    }
  }, [
    handlePersistEvidenceSync,
    handlePersistProgressSync,
    handlePersistSourceSync,
    isStreamGenerating,
    recordSyncFailure,
  ]);

  orderedPersistRetryRef.current = handleOrderedPersistRetry;

  const handleComposerSubmit = useCallback(async () => {
    const bodyText = pastedText?.trim() ?? inputText.trim();
    const isTransformRetry =
      (inlineGenerationStatusRef.current === 'error' ||
        inlineGenerationStatusRef.current === 'cancelled') &&
      inlineRetryPayloadRef.current != null &&
      !bodyText &&
      !uploadedFile;
    const isAskRetry =
      inlineGenerationStatusRef.current === 'error' &&
      askRetryQuestionRef.current != null &&
      inlineUserTurn?.kind === 'ask';

    if (!isAskRetry) {
      trackProductEvent('transform_start');
    }

    if (isAskRetry) {
      await handleAsk();
      return;
    }
    const activeMapForSync =
      inlineResultEntryIdRef.current || historyStoreRef.current.activeId || '';
    const hasPending =
      Boolean(activeMapForSync && pendingSyncByMapId[activeMapForSync]) ||
      Boolean(
        activeAuthRef.current.getSnapshot()?.userId &&
          activeMapForSync &&
          getPendingSourceSyncForMap(
            activeAuthRef.current.getSnapshot()!.userId,
            activeMapForSync
          )
      ) ||
      Boolean(
        activeAuthRef.current.getSnapshot()?.userId &&
          activeMapForSync &&
          getPendingPdfSourceSyncForMap(
            activeAuthRef.current.getSnapshot()!.userId,
            activeMapForSync
          )
      );
    const hasEvidencePending =
      Boolean(activeMapForSync && pendingEvidenceSyncByMapId[activeMapForSync]) ||
      Boolean(
        activeAuthRef.current.getSnapshot()?.userId &&
          activeMapForSync &&
          getPendingEvidenceSyncForMap(
            activeAuthRef.current.getSnapshot()!.userId,
            activeMapForSync
          )
      );
    if (
      (hasPending || hasEvidencePending) &&
      inlineGenerationStatusRef.current === 'ready' &&
      !isStreamGenerating
    ) {
      await handleOrderedPersistRetry();
      return;
    }
    if (isTransformRetry) {
      await handleTransform();
      return;
    }

    const kind = classifyComposerSubmit({
      inputText,
      pastedText,
      uploadedFile,
      surface: homeSurface,
    });
    if (kind === 'ask') {
      await handleAsk();
      return;
    }
    await handleTransform();
  }, [handleAsk, handleOrderedPersistRetry, handleTransform, homeSurface, inlineUserTurn?.kind, inputText, isStreamGenerating, pastedText, pendingEvidenceSyncByMapId, pendingSyncByMapId, uploadedFile]);

  const handleNewMap = useCallback(() => {
    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const updatedStore = setActiveId(currentStore, null);
    commitHistoryStore(updatedStore);
    setInputText('');
    inputTextRef.current = '';
    setPastedText(null);
    intentPinnedRef.current = null;
    setUploadedFile(null);
    clearComposerDraft();
    setAttachMenuOpen(false);
    setData(null);
    setEditorialDemoPlan(null);
    setError(null);
    setTransformIncomplete(false);
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setLayer0Passed(false);
    setLayer0CheckedActionIds([]);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    continueTransitionEnteredAtRef.current = null;
    continueChipRectRef.current = null;
    continueChipLabelRef.current = '';
    continueEntryIdRef.current = null;
    setContinueTransition(null);
    setContinueTransitionHandoff(false);
    setResumeBannerVisible(false);
    clearInlineGeneration();
    setPhase('input');
  }, [clearInlineGeneration, commitHistoryStore, flushPendingSessionPersist]);

  const handleOpenDemoNucleo = useCallback(() => {
    flushPendingSessionPersist();
    setEditorialDemoPlan(null);
    const currentStore = historyStoreRef.current;
    // Always refresh fixture so presentation/copy changes land on Preview / ejemplo.
    const normalized = normalizeMapData(DEMO_NUCLEO_DATA) ?? DEMO_NUCLEO_DATA;
    const existing = currentStore.entries.find((entry) => entry.id === DEMO_NUCLEO_ID);
    const demoSession = {
      data: normalized,
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    };

    if (existing) {
      const updatedEntries = currentStore.entries.map((entry) =>
        entry.id === DEMO_NUCLEO_ID
          ? {
              ...entry,
              title: normalized.title,
              session: {
                ...demoSession,
                isComplete: existing.session.isComplete ?? false,
                viewAll: existing.session.isComplete ?? false,
              },
              updatedAt: Date.now(),
            }
          : entry
      );
      commitHistoryStore(setActiveId({ ...currentStore, entries: updatedEntries }, DEMO_NUCLEO_ID));
      setData(normalized);
      setIntentState(normalized.intent ?? 'understand');
      const wasComplete = existing.session.isComplete ?? false;
      setCurrentStep(0);
      setIsComplete(wasComplete);
      setViewAll(wasComplete);
      setLayer0Passed(false);
      setLayer0CheckedActionIds([]);
      setHistoryOpen(false);
      setChatOpen(false);
      setEssentialsReview(false);
      setPhase('result');
      setError(null);
      setTransformIncomplete(false);
      persistSessionState(0, wasComplete, wasComplete, { layer0Passed: false });
      return;
    }

    const updatedStore = createEntry(currentStore, demoSession, 'text', DEMO_NUCLEO_ID);
    commitHistoryStore(updatedStore);
    setData(normalized);
    setIntentState('understand');
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setLayer0Passed(false);
    setLayer0CheckedActionIds([]);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    setPhase('result');
    setError(null);
    setTransformIncomplete(false);
  }, [commitHistoryStore, flushPendingSessionPersist, persistSessionState]);

  const handleSignOut = useCallback(async () => {
    const envelope = getHistoryOwnershipEnvelope();
    const envelopeOwnerId =
      envelope.activeOwner.kind === 'user' ? envelope.activeOwner.userId : null;

    const begin = activeAuthRef.current.beginSignOut({ envelopeOwnerId });
    if (begin.ok === false) {
      if (begin.reason === 'in_progress') return;
      // Already signed out / inconsistent — seal guest locally without remote call.
      pendingDeletesRef.current = [];
      setCloudUserId(null);
      setCloudUserEmail(null);
      setCloudUserDisplayName(null);
      setCloudUserAvatarUrl(null);
      flushPendingSessionPersist();
      saveHistory(historyStoreRef.current);
      const sealed = activateHistoryOwner({ kind: 'guest' });
      commitHistoryStore(sealed.envelope.guest);
      setPendingProgressSyncByMapId({});
      return;
    }

    pendingDeletesRef.current = [];
    flushPendingSessionPersist();

    // Only clear UI / seal guest while our invalidation remains current (no B yet).
    if (activeAuthRef.current.isCurrent(begin.invalidationEpoch, null)) {
      setCloudUserId(null);
      setCloudUserEmail(null);
      setCloudUserDisplayName(null);
      setCloudUserAvatarUrl(null);

      setHistoryOpen(false);
      setChatOpen(false);
      setAuthOpen(false);

      setData(null);
      setInputText('');
      inputTextRef.current = '';
      setPastedText(null);
      setUploadedFile(null);
      setPhase('input');
      setError(null);
      setTransformIncomplete(false);
      setCurrentStep(0);
      setIsComplete(false);
      setViewAll(false);
      const signedOutUserId = begin.captured?.userId;
      if (signedOutUserId) {
        // Seal for next login — do not purge on normal sign-out.
        sealPendingApplicationOpsForUser(signedOutUserId);
        // Keep active plan digests for CAS on next login (owner-scoped store).
        stagedReplanRef.current = null;
        setStagedReplan(null);
      }
      setPendingApplicationSyncByMapId({});
      setPendingApplicationReviewSyncByMapId({});
      setPendingProgressSyncByMapId({});

      saveHistory(historyStoreRef.current);
      const sealed = activateHistoryOwner({ kind: 'guest' });
      commitHistoryStore(sealed.envelope.guest);
    }

    const remote = activeAuthRef.current.resolveSignOutRemote(
      begin.invalidationEpoch,
      begin.captured
    );
    if (remote.action !== 'remote_sign_out') {
      // B (or another identity) is active — never sign out their session.
      return;
    }

    try {
      await signOut();
    } catch (err) {
      console.error('Error al cerrar sesión remota:', err);
      throw err;
    }
  }, [commitHistoryStore, flushPendingSessionPersist]);

  const handleDeleteAccount = useCallback(async () => {
    const envelope = getHistoryOwnershipEnvelope();
    const envelopeOwnerId =
      envelope.activeOwner.kind === 'user' ? envelope.activeOwner.userId : null;

    const begin = activeAuthRef.current.beginDeleteAccount({ envelopeOwnerId });
    if (begin.ok === false) {
      if (begin.reason === 'in_progress') return;
      throw new Error(
        begin.reason === 'envelope_mismatch'
          ? 'La identidad cambió; vuelve a intentarlo.'
          : 'Inicia sesión para eliminar la cuenta.'
      );
    }

    pendingDeletesRef.current = [];
    flushPendingSessionPersist();

    const failClosed = (err: unknown) => {
      const resolution = activeAuthRef.current.resolveDeleteFailure(
        begin.invalidationEpoch,
        begin.captured
      );
      if (resolution.action === 'restore') {
        setCloudUserId(resolution.snapshot.userId);
        // Profile fields may already be null; keep partition intact.
        throw err instanceof Error ? err : new Error('No se pudo eliminar la cuenta.');
      }
      // Superseded by B — do not restore A, do not surface error on B.
      return;
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(apiUrl('/api/account/delete'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${begin.captured.accessToken}`,
        },
      });
    } catch (err) {
      failClosed(err);
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      failClosed(
        new Error(
          payload.error ||
            (payload.code === 'delete_not_configured'
              ? 'El borrado de cuenta no está configurado en el servidor.'
              : 'No se pudo eliminar la cuenta.')
        )
      );
      return;
    }

    const resolution = activeAuthRef.current.resolveDeleteSuccess(
      begin.invalidationEpoch,
      begin.captured
    );

    // Always purge A's local partition/metadata; never touch B's partition.
    saveHistory(historyStoreRef.current);
    clearPendingApplicationOpsForUser(resolution.purgedUserId);
    clearActivePlanDigestsForUser(resolution.purgedUserId);
    const purged = removeHistoryOwnerFromStorage(resolution.purgedUserId);

    if (resolution.action === 'purge_partition_only') {
      // B is active — keep B UI/session; only ensure active store matches envelope.
      const active =
        purged.activeOwner.kind === 'guest'
          ? purged.guest
          : purged.byUserId[purged.activeOwner.userId] ?? {
              activeId: null,
              entries: [],
              collections: [],
            };
      commitHistoryStore(active);
      return;
    }

    // full_local_clear: invalidation still current — clear UI, guest, local credentials.
    setCloudUserId(null);
    setCloudUserEmail(null);
    setCloudUserDisplayName(null);
    setCloudUserAvatarUrl(null);

    setHistoryOpen(false);
    setChatOpen(false);
    setAuthOpen(false);
    setData(null);
    setInputText('');
    inputTextRef.current = '';
    setPastedText(null);
    setUploadedFile(null);
    setPhase('input');
    setError(null);
    setTransformIncomplete(false);
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);

    const sealed = activateHistoryOwner({ kind: 'guest' });
    commitHistoryStore(sealed.envelope.guest);

    if (resolution.shouldLocalSignOut) {
      try {
        await signOut();
      } catch (err) {
        console.error('Error al cerrar sesión tras borrar cuenta:', err);
        try {
          await supabase?.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }
      }
    }
  }, [commitHistoryStore, flushPendingSessionPersist]);

  const resetToEmptyInput = useCallback(() => {
    setDismissedContinueId(null);
    setInputText('');
    inputTextRef.current = '';
    setPastedText(null);
    setUploadedFile(null);
    clearComposerDraft();
    setAttachMenuOpen(false);
    setData(null);
    setError(null);
    setTransformIncomplete(false);
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    setResumeBannerVisible(false);
    setPhase('input');
  }, []);

  const devHideHistory = useCallback(() => {
    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const emptyStore = hideHistoryForDev(currentStore);
    commitHistoryStore(emptyStore);
    setDevHistoryHidden(true);
    resetToEmptyInput();
  }, [commitHistoryStore, flushPendingSessionPersist, resetToEmptyInput]);

  const devRestoreHistory = useCallback(() => {
    flushPendingSessionPersist();
    const restored = restoreHistoryFromDev();
    if (!restored) {
      setDevHistoryHidden(false);
      return;
    }
    commitHistoryStore(restored);
    setDevHistoryHidden(false);
    resetToEmptyInput();
  }, [commitHistoryStore, flushPendingSessionPersist, resetToEmptyInput]);

  const previewInlineGeneration = useCallback(() => {
    if (!canUseDevTools()) return;

    clearDevPreviewTimers();
    clearInlineAutoOpen();
    clearInlineReadyTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetStreamGenerationUi();
    setError(null);
    setTransformIncomplete(false);
    setPhase('input');
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    setData(null);
    inlineResultEntryIdRef.current = null;
    setDevPreviewGenerationActive(true);

    setInlineUserTurn(
      buildInlineUserTurnSnapshot({
        inputText:
          'Texto de prueba para revisar el flujo inline de generación sin llamar al backend.',
        pastedText: null,
        uploadedFile: null,
        conversationalMessage: pickInlineConversationalMessage(cloudUserDisplayName),
        kind: 'source',
      })
    );
    setInlineGenerationStatus('generating');
    setIsAnalyzingSource(true);
    streamProgressShared.value = 0;

    // Intentionally slow so DEV preview phases are easy to inspect (~25s total).
    scheduleDevPreview(() => {
      setIsAnalyzingSource(false);
      setIsStreamGenerating(true);
      bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[0]);
      streamProgressShared.value = STREAM_PROGRESS_MILESTONES[0];
      setStreamLoadPhase(0);
    }, 3000);

    scheduleDevPreview(() => {
      bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[1]);
    }, 7000);

    scheduleDevPreview(() => {
      setData({
        ...DEMO_NUCLEO_DATA,
        steps: [],
      });
      setStreamLoadPhase(1);
      bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[2]);
    }, 13000);

    scheduleDevPreview(() => {
      setData(DEMO_NUCLEO_DATA);
      setStreamLoadPhase(2);
      bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[3]);
    }, 19000);

    scheduleDevPreview(() => {
      setIsStreamGenerating(false);
      bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[4]);
      streamProgressShared.value = STREAM_PROGRESS_MILESTONES[4];

      let store = historyStoreRef.current;
      const existing = store.entries.find((entry) => entry.id === DEMO_NUCLEO_ID);
      if (!existing) {
        store = createEntry(
          store,
          {
            data: DEMO_NUCLEO_DATA,
            currentStep: 0,
            isComplete: false,
            viewAll: false,
          },
          'text',
          DEMO_NUCLEO_ID
        );
      }
      commitHistoryStore(store);
      inlineResultEntryIdRef.current = DEMO_NUCLEO_ID;
      setData(DEMO_NUCLEO_DATA);

      scheduleDevPreview(() => {
        if ((inlineGenerationStatusRef.current !== 'generating' && inlineGenerationStatusRef.current !== 'partial')) return;
        setDevPreviewGenerationActive(false);
        setInlineGenerationStatus('ready');
      }, INTRO_TRANSITION_BAR_MS);
    }, 25000);
  }, [
    bumpStreamProgressCap,
    canUseDevTools,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineReadyTimeout,
    cloudUserDisplayName,
    commitHistoryStore,
    resetStreamGenerationUi,
    scheduleDevPreview,
    streamProgressShared,
  ]);

  /** Jump straight to the ready inline chat (Abrir Núcleo) before opening the map. */
  const previewPreMapChat = useCallback(() => {
    if (!canUseDevTools()) return;

    clearDevPreviewTimers();
    clearInlineAutoOpen();
    clearInlineReadyTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetStreamGenerationUi();
    setError(null);
    setTransformIncomplete(false);
    setPhase('input');
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    setDevPreviewGenerationActive(false);

    setInlineUserTurn(
      buildInlineUserTurnSnapshot({
        inputText:
          'Texto de prueba para revisar el chat previo al mapa sin llamar al backend.',
        pastedText: null,
        uploadedFile: null,
        conversationalMessage: pickInlineConversationalMessage(cloudUserDisplayName),
        kind: 'source',
      })
    );

    let store = historyStoreRef.current;
    const existing = store.entries.find((entry) => entry.id === DEMO_NUCLEO_ID);
    if (!existing) {
      store = createEntry(
        store,
        {
          data: DEMO_NUCLEO_DATA,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        },
        'text',
        DEMO_NUCLEO_ID
      );
      commitHistoryStore(store);
    }
    inlineResultEntryIdRef.current = DEMO_NUCLEO_ID;
    setData(DEMO_NUCLEO_DATA);
    bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[4]);
    streamProgressShared.value = STREAM_PROGRESS_MILESTONES[4];
    setInlineGenerationStatus('ready');
  }, [
    bumpStreamProgressCap,
    canUseDevTools,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineReadyTimeout,
    cloudUserDisplayName,
    commitHistoryStore,
    resetStreamGenerationUi,
    streamProgressShared,
  ]);

  const previewLoadingScreen = useCallback(() => {
    if (!canUseDevTools()) return;

    clearDevPreviewTimers();
    clearInlineAutoOpen();
    clearInlineReadyTimeout();
    clearInlineGeneration();
    resetStreamGenerationUi();
    setError(null);
    setTransformIncomplete(false);
    setEditorialDemoPlan(null);
    setLoadingFadeOverlayActive(false);
    // Full LoadingScreen (LoadingState) — not the inline generation trail.
    setPhase('loading');
    setDevPreviewGenerationActive(true);
    setIsAnalyzingSource(false);
    setIsStreamGenerating(true);
    setCollectionGenerationProgress({ completed: 0, total: 4 });
    streamProgressShared.value = 0;

    // Keep generating (and the official rotate beam) long enough to inspect.
    scheduleDevPreview(() => {
      setCollectionGenerationProgress({ completed: 1, total: 4 });
      streamProgressShared.value = 25;
    }, 1500);

    scheduleDevPreview(() => {
      setCollectionGenerationProgress({ completed: 2, total: 4 });
      streamProgressShared.value = 50;
    }, 4000);

    scheduleDevPreview(() => {
      setCollectionGenerationProgress({ completed: 3, total: 4 });
      streamProgressShared.value = 75;
    }, 7000);

    scheduleDevPreview(() => {
      setCollectionGenerationProgress({ completed: 4, total: 4 });
      streamProgressShared.value = 100;
    }, 10000);

    scheduleDevPreview(() => {
      setIsStreamGenerating(false);
    }, 12000);

    scheduleDevPreview(() => {
      setCollectionGenerationProgress(null);
      setDevPreviewGenerationActive(false);
      resetStreamGenerationUi();
      setPhase('input');
    }, 14000);
  }, [
    canUseDevTools,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineGeneration,
    clearInlineReadyTimeout,
    resetStreamGenerationUi,
    scheduleDevPreview,
    streamProgressShared,
  ]);

  const previewNucleo = useCallback(() => {
    if (!canUseDevTools()) return;

    clearDevPreviewTimers();
    clearInlineGeneration();
    resetStreamGenerationUi();
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    setDevPreviewGenerationActive(false);

    // Editorial vertical demo — auto cognitive route, native pages + local glyphs.
    const editorialMap = buildEditorialDemoMap('procrastination');
    const normalized = normalizeMapData(editorialMap) ?? editorialMap;
    const plan = normalized.editorialPlan ?? editorialMap.editorialPlan ?? null;
    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const existing = currentStore.entries.find((entry) => entry.id === EDITORIAL_DEMO_NUCLEO_ID);
    const demoSession = {
      data: normalized,
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    };

    if (existing) {
      const updatedEntries = currentStore.entries.map((entry) =>
        entry.id === EDITORIAL_DEMO_NUCLEO_ID
          ? {
              ...entry,
              title: normalized.title,
              session: demoSession,
              updatedAt: Date.now(),
            }
          : entry
      );
      commitHistoryStore(setActiveId({ ...currentStore, entries: updatedEntries }, EDITORIAL_DEMO_NUCLEO_ID));
    } else {
      commitHistoryStore(createEntry(currentStore, demoSession, 'text', EDITORIAL_DEMO_NUCLEO_ID));
    }

    setData(normalized);
    setIntentState(normalized.intent ?? 'understand');
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setLayer0Passed(true);
    setLayer0CheckedActionIds([]);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    setError(null);
    setTransformIncomplete(false);
    setEditorialDemoPlan(plan);
    setPhase('result');
    if (__DEV__ && !plan) {
      console.warn('[previewNucleo] editorial plan missing after normalize');
    }
  }, [
    canUseDevTools,
    clearDevPreviewTimers,
    clearInlineGeneration,
    commitHistoryStore,
    flushPendingSessionPersist,
    resetStreamGenerationUi,
  ]);

  const previewChatThinking = useCallback(() => {
    if (!canUseDevTools()) return;

    clearDevPreviewTimers();
    clearInlineAutoOpen();
    clearInlineReadyTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetStreamGenerationUi();
    setError(null);
    setTransformIncomplete(false);
    setPhase('input');
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    setDevPreviewGenerationActive(false);
    setData(null);
    inlineResultEntryIdRef.current = null;
    setHomeSurfaceState('chat');
    setInlineAskPriorTurns([]);
    setInlineAskChatId(null);
    setInlineAskAnswer(null);
    setInlineAskDisclaimer(null);
    setInlineAskCtaLabel(null);
    setInlineAskModelUsed(null);
    setInlineUserTurn(
      buildInlineUserTurnSnapshot({
        inputText: '¿Cómo se usa Thinking en Chat?',
        pastedText: null,
        uploadedFile: null,
        conversationalMessage: '',
        kind: 'ask',
      })
    );
    setInlineGenerationStatus('generating');
    setInputText('');
    inputTextRef.current = '';
    setPastedText(null);
    setUploadedFile(null);
  }, [
    canUseDevTools,
    clearDevPreviewTimers,
    clearInlineAutoOpen,
    clearInlineReadyTimeout,
    resetStreamGenerationUi,
  ]);

  const openEditorialDemo = useCallback((fixtureId: 'procrastination' | 'attention' = 'procrastination') => {
    // Direct in-memory path — PhaseRouter renders EditorialDemoScreen immediately.
    // Do not gate on canUseDevTools here; the menu already requires DEV mode.
    clearDevPreviewTimers();
    clearInlineGeneration();
    resetStreamGenerationUi();
    setIsStreamGenerating(false);
    setIsAnalyzingSource(false);
    setCollectionGenerationProgress(null);
    setDevPreviewGenerationActive(false);

    const editorialMap = buildEditorialDemoMap(fixtureId);
    const plan = editorialMap.editorialPlan;
    if (!plan) {
      Alert.alert('Demo editorial', 'No se pudo construir el plan. Revisa shared/editorial.');
      return;
    }

    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const demoSession = {
      data: editorialMap,
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    };
    const entryId =
      fixtureId === 'attention' ? `${EDITORIAL_DEMO_NUCLEO_ID}-attention` : EDITORIAL_DEMO_NUCLEO_ID;
    const existing = currentStore.entries.find((entry) => entry.id === entryId);
    if (existing) {
      const updatedEntries = currentStore.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              title: editorialMap.title,
              session: demoSession,
              updatedAt: Date.now(),
            }
          : entry
      );
      commitHistoryStore(setActiveId({ ...currentStore, entries: updatedEntries }, entryId));
    } else {
      commitHistoryStore(createEntry(currentStore, demoSession, 'text', entryId));
    }

    setData(editorialMap);
    setIntentState(editorialMap.intent ?? 'understand');
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setLayer0Passed(true);
    setLayer0CheckedActionIds([]);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    setError(null);
    setTransformIncomplete(false);
    setEditorialDemoPlan(plan);
    setPhase('result');
  }, [
    clearDevPreviewTimers,
    clearInlineGeneration,
    commitHistoryStore,
    flushPendingSessionPersist,
    resetStreamGenerationUi,
  ]);

  const closeEditorialDemo = useCallback(() => {
    setEditorialDemoPlan(null);
    setPhase('input');
    setData(null);
    setHistoryOpen(false);
    setChatOpen(false);
  }, []);

  const handleSelectHistory = useCallback(
    (id: string) => {
      flushPendingSessionPersist();
      let currentStore = insertLumenHomeSample(historyStoreRef.current, id);
      if (currentStore !== historyStoreRef.current) {
        try {
          commitHistoryStore(currentStore);
        } catch {
          /* Open the canvas even if history persist fails. */
        }
      }
      const entry = currentStore.entries.find((e) => e.id === id);
      const catalogMap = lumenHomeMap(id);
      if (!entry && !catalogMap) return;

      if (entry && isChatHistoryEntry(entry) && entry.chat) {
        setEditorialDemoPlan(null);
        setData(null);
        setHistoryOpen(false);
        setChatOpen(false);
        setEssentialsReview(false);
        continueTransitionEnteredAtRef.current = null;
        continueChipRectRef.current = null;
        continueChipLabelRef.current = '';
        continueEntryIdRef.current = null;
        setContinueTransition(null);
        setContinueTransitionHandoff(false);
        setError(null);
        setTransformIncomplete(false);
        setResumeBannerVisible(false);
        const exchanges =
          typeof chatExchanges === 'function'
            ? chatExchanges(entry.chat)
            : Array.isArray(entry.chat.exchanges) && entry.chat.exchanges.length > 0
              ? entry.chat.exchanges
              : [{ question: entry.chat.question, answer: entry.chat.answer }];
        const normalizedExchanges = exchanges.map((item) => ({
          question: item.question,
          answer: visibleAskAnswer(item.answer),
        }));
        const last = normalizedExchanges[normalizedExchanges.length - 1] ?? {
          question: entry.chat.question,
          answer: visibleAskAnswer(entry.chat.answer),
        };
        setInlineAskChatId(entry.id);
        setInlineAskPriorTurns(normalizedExchanges.slice(0, -1));
        setInlineUserTurn(
          buildInlineUserTurnSnapshot({
            inputText: last.question,
            pastedText: null,
            uploadedFile: null,
            conversationalMessage: '',
            kind: 'ask',
            revealInstant: true,
          })
        );
        setInlineAskAnswer(visibleAskAnswer(last.answer));
        setInlineAskDisclaimer(null);
        setInlineAskCtaLabel(null);
        setInlineAskModelUsed(entry.chat.modelUsed ?? null);
        setInlineGenerationStatus('ready');
        setPhase('input');
        setHomeSurfaceState('chat');
        return;
      }

      setHomeSurfaceState('nucleo');
      const baseMap =
        (entry ? normalizeMapData(entry.session.data) : null) ??
        (catalogMap ? normalizeMapData(catalogMap) ?? catalogMap : null);
      if (!baseMap) return;
      const normalizedRaw = attachLumenCanvas(catalogMap ?? entry?.session.data, baseMap);
      const normalized = preferUnderstandingWhenApplicationNeedsContext(normalizedRaw);

      const updatedStore = entry ? setActiveId(currentStore, id) : currentStore;
      try {
        commitHistoryStore(updatedStore);
      } catch {
        /* Keep the in-memory canvas open. */
      }

      setEditorialDemoPlan(null);
      setData(normalized);
      setIntentState(normalized.intent ?? 'understand');
      const restored = restoreResumeUiState(
        normalized,
        entry?.session ?? {
          data: normalized,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        }
      );
      setCurrentStep(restored.currentStep);
      setIsComplete(restored.isComplete);
      setViewAll(restored.viewAll || restored.isComplete);
      setLayer0Passed(restored.layer0Passed);
      setLayer0CheckedActionIds(restored.layer0CheckedActionIds);
      setHistoryOpen(false);
      setChatOpen(false);
      setEssentialsReview(false);
      continueTransitionEnteredAtRef.current = null;
      continueChipRectRef.current = null;
      continueChipLabelRef.current = '';
      continueEntryIdRef.current = null;
      setContinueTransition(null);
      setContinueTransitionHandoff(false);
      setPhase('result');
      setError(null);
      setTransformIncomplete(false);
      setResumeBannerVisible(!restored.isComplete);
    },
    [commitHistoryStore, flushPendingSessionPersist]
  );

  const beginContinueTransition = useCallback(
    (id: string, chipRect: ContinueChipRect, chipLabel: string) => {
      flushPendingSessionPersist();
      const currentStore = insertLumenHomeSample(historyStoreRef.current, id);
      if (currentStore !== historyStoreRef.current) {
        commitHistoryStore(currentStore);
      }
      const entry = currentStore.entries.find((e) => e.id === id);
      if (!entry || isChatHistoryEntry(entry)) return;

      const normalizedRaw = normalizeMapData(entry.session.data);
      if (!normalizedRaw) return;
      const normalized = preferUnderstandingWhenApplicationNeedsContext(normalizedRaw);

      const updatedStore = setActiveId(currentStore, id);
      commitHistoryStore(updatedStore);

      setData(normalized);
      setIntentState(normalized.intent ?? 'understand');
      const restored = restoreResumeUiState(normalized, entry.session);
      setCurrentStep(restored.currentStep);
      setIsComplete(restored.isComplete);
      setViewAll(restored.viewAll);
      setLayer0Passed(restored.layer0Passed);
      setLayer0CheckedActionIds(restored.layer0CheckedActionIds);
      setHistoryOpen(false);
      setChatOpen(false);
      setEssentialsReview(false);
      setError(null);
      setTransformIncomplete(false);
      setContinueTransitionHandoff(false);
      // This transition is used by the just-generated inline result. It is a
      // first open, not a resumed session, so "Retomas aquí" is misleading.
      setResumeBannerVisible(false);
      continueChipRectRef.current = chipRect;
      continueChipLabelRef.current = chipLabel;
      continueEntryIdRef.current = id;
      setEditorialDemoPlan(null);
      setContinueTransition({
        mode: 'expand',
        chipRect,
        chipLabel,
        entryId: id,
      });
    },
    [commitHistoryStore, flushPendingSessionPersist]
  );

  const openInlineResult = useCallback(
    (chipRect: ContinueChipRect) => {
      const entryId = inlineResultEntryIdRef.current;
      if (!entryId || inlineGenerationStatusRef.current !== 'ready') return;

      const entry = historyStoreRef.current.entries.find((item) => item.id === entryId);
      if (!entry) return;

      clearInlineAutoOpen();
      clearInlineGeneration();
      beginContinueTransition(entryId, chipRect, buildContinueChipLabel(entry.title));
    },
    [beginContinueTransition, clearInlineAutoOpen, clearInlineGeneration]
  );

  const finishContinueExpandTransition = useCallback(() => {
    // #region agent log
    debugTransitionLog('H3', 'AppSessionContext.tsx:finishExpand', 'phase switching to result', {}, 'post-fix-v7');
    // #endregion
    continueTransitionEnteredAtRef.current = Date.now();
    continueHandoffLayoutReadyRef.current = false;
    continueHandoffGlassExpectedRef.current = 0;
    continueHandoffGlassActiveRef.current = 0;
    if (continueHandoffPrewarmEndRef.current) {
      clearTimeout(continueHandoffPrewarmEndRef.current);
      continueHandoffPrewarmEndRef.current = null;
    }
    setContinueHandoffPrewarm(true);
    setContinueTransitionHandoff(true);
    setPhase('result');
    if (continueHandoffFallbackRef.current) {
      clearTimeout(continueHandoffFallbackRef.current);
    }
    continueHandoffFallbackRef.current = setTimeout(() => {
      continueHandoffFallbackRef.current = null;
      setContinueTransition((current) => {
        if (!current) return current;
        // #region agent log
        debugTransitionLog('H23', 'AppSessionContext.tsx:handoffFallback', 'forced overlay cleanup', {}, 'post-fix-v7');
        // #endregion
        setContinueTransitionHandoff(false);
        return null;
      });
    }, 600);
  }, []);

  const completeContinueTransitionHandoff = useCallback(() => {
    if (continueHandoffFallbackRef.current) {
      clearTimeout(continueHandoffFallbackRef.current);
      continueHandoffFallbackRef.current = null;
    }
    continueHandoffLayoutReadyRef.current = false;
    continueHandoffGlassExpectedRef.current = 0;
    continueHandoffGlassActiveRef.current = 0;
    // #region agent log
    debugTransitionLog('H3', 'AppSessionContext.tsx:handoffComplete', 'overlay handoff complete', {}, 'post-fix-v8');
    // #endregion
    setContinueTransition(null);
    setContinueTransitionHandoff(false);
    if (continueHandoffPrewarmEndRef.current) {
      clearTimeout(continueHandoffPrewarmEndRef.current);
    }
    continueHandoffPrewarmEndRef.current = setTimeout(() => {
      continueHandoffPrewarmEndRef.current = null;
      setContinueHandoffPrewarm(false);
      // #region agent log
      debugTransitionLog('H30', 'AppSessionContext.tsx:prewarmEnd', 'handoff glass prewarm ended', {}, 'post-fix-v8');
      // #endregion
    }, 320);
  }, []);

  const tryCompleteContinueHandoff = useCallback(() => {
    if (!continueHandoffLayoutReadyRef.current) {
      return;
    }
    const expected = continueHandoffGlassExpectedRef.current;
    const active = continueHandoffGlassActiveRef.current;
    if (expected === 0 || active < expected) {
      // #region agent log
      debugTransitionLog(
        'H29',
        'AppSessionContext.tsx:handoffWait',
        'waiting for all handoff glass',
        { expected, active },
        'post-fix-v7'
      );
      // #endregion
      return;
    }
    // #region agent log
    debugTransitionLog(
      'H29',
      'AppSessionContext.tsx:allGlassReady',
      'all handoff glass active',
      { expected, active },
      'post-fix-v7'
    );
    // #endregion
    completeContinueTransitionHandoff();
  }, [completeContinueTransitionHandoff]);

  const markContinueHandoffLayoutReady = useCallback(() => {
    continueHandoffLayoutReadyRef.current = true;
    // #region agent log
    debugTransitionLog('H28', 'AppSessionContext.tsx:layoutReady', 'result layout ready for handoff', {}, 'post-fix-v7');
    // #endregion
    tryCompleteContinueHandoff();
  }, [tryCompleteContinueHandoff]);

  const registerContinueHandoffGlassTarget = useCallback(() => {
    continueHandoffGlassExpectedRef.current += 1;
    // #region agent log
    debugTransitionLog(
      'H29',
      'AppSessionContext.tsx:glassRegister',
      'handoff glass target registered',
      { expected: continueHandoffGlassExpectedRef.current },
      'post-fix-v7'
    );
    // #endregion
    tryCompleteContinueHandoff();
  }, [tryCompleteContinueHandoff]);

  const notifyContinueHandoffGlassActive = useCallback(() => {
    continueHandoffGlassActiveRef.current += 1;
    // #region agent log
    debugTransitionLog(
      'H29',
      'AppSessionContext.tsx:glassActive',
      'handoff glass target active',
      {
        expected: continueHandoffGlassExpectedRef.current,
        active: continueHandoffGlassActiveRef.current,
      },
      'post-fix-v7'
    );
    // #endregion
    tryCompleteContinueHandoff();
  }, [tryCompleteContinueHandoff]);

  const canReverseContinueTransition = useCallback(() => {
    if (phase !== 'result') return false;
    if (continueTransitionEnteredAtRef.current == null) return false;
    if (Date.now() - continueTransitionEnteredAtRef.current > CONTINUE_IMMEDIATE_BACK_MS) {
      return false;
    }
    if (!continueChipRectRef.current || !continueChipLabelRef.current) return false;
    if (!continueEntryIdRef.current) return false;
    const entry = historyStoreRef.current.entries.find((e) => e.id === continueEntryIdRef.current);
    if (!entry) return false;
    if (dismissedContinueId === entry.id) return false;
    return true;
  }, [dismissedContinueId, phase]);

  const finishContinueCollapseTransition = useCallback(() => {
    continueTransitionEnteredAtRef.current = null;
    continueChipRectRef.current = null;
    continueChipLabelRef.current = '';
    continueEntryIdRef.current = null;
    setContinueTransition(null);
    setContinueTransitionHandoff(false);
    clearInlineGeneration();
    setPhase('input');
  }, [clearInlineGeneration]);

  const startReverseContinueTransition = useCallback(() => {
    if (!canReverseContinueTransition()) return false;
    const chipRect = continueChipRectRef.current;
    const chipLabel = continueChipLabelRef.current;
    const entryId = continueEntryIdRef.current;
    if (!chipRect || !chipLabel || !entryId) return false;

    setContinueTransition({
      mode: 'collapse',
      chipRect,
      chipLabel,
      entryId,
    });
    return true;
  }, [canReverseContinueTransition]);

  const handleDeleteHistory = useCallback(
    (id: string) => {
      const currentStore = historyStoreRef.current;
      const wasActive = currentStore.activeId === id;

      const updatedStore = deleteEntry(currentStore, id);
      commitHistoryStore(updatedStore);
      const liveOwner = activeAuthRef.current.getSnapshot();
      if (liveOwner?.userId) {
        removePendingProgressSync(liveOwner.userId, id);
        setPendingProgressSyncByMapId((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        removePendingEvidenceSync(liveOwner.userId, id);
        setPendingEvidenceSyncByMapId((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        void removePendingPdfSourceSyncByMapId(liveOwner.userId, id);
        removeAllPendingApplicationOpsForMap(liveOwner.userId, id);
        delete applicationPlanDigestRef.current[id];
        clearActivePlanDigest(liveOwner.userId, id);
        setPendingApplicationSyncByMapId((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setPendingApplicationReviewSyncByMapId((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

      if (cloudSignedIn) {
        const live = activeAuthRef.current.getSnapshot();
        const envelopeNow = getHistoryOwnershipEnvelope();
        const ownerId =
          envelopeNow.activeOwner.kind === 'user' ? envelopeNow.activeOwner.userId : null;
        if (live && ownerId && live.userId === ownerId) {
          const capturedUserId = live.userId;
          const epoch = live.epoch;
          const nextDeletes = Array.from(new Set([...getPendingDeletes(capturedUserId), id]));
          savePendingDeletes(capturedUserId, nextDeletes);
          if (activeAuthRef.current.isCurrent(epoch, capturedUserId)) {
            pendingDeletesRef.current = nextDeletes;
          }

          const snapshot = captureMutationSnapshot({
            epoch: live.epoch,
            activeUserId: live.userId,
            accessToken: live.accessToken,
          });
          if (snapshot) {
            void (async () => {
              const { outcome } = await runBoundCloudMutation({
                snapshot,
                gate: {
                  isCurrent: (e, u) => activeAuthRef.current.isCurrent(e, u),
                },
                expectedOwnerId: capturedUserId,
                createClient: (snap) => {
                  const bound = createSessionBoundSupabase(snap.accessToken);
                  return {
                    expectedUserId: snap.userId,
                    deleteEntry: (entryId: string) =>
                      deleteCloudHistoryEntryWithClient(bound, entryId),
                  };
                },
                run: async (client) => {
                  await client.deleteEntry(id);
                  return id;
                },
                onErrorCurrent: (err) => {
                  console.error(
                    `Error al eliminar en la nube el mapa ${id}. Se reintentará en segundo plano.`,
                    err
                  );
                },
              });

              if (outcome === 'applied') {
                const updated = getPendingDeletes(capturedUserId).filter((item) => item !== id);
                savePendingDeletes(capturedUserId, updated);
                if (activeAuthRef.current.isCurrent(epoch, capturedUserId)) {
                  pendingDeletesRef.current = updated;
                }
              }
            })();
          }
        }
      }

      if (wasActive) {
        setData(null);
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setError(null);
        setPhase('input');
      }
    },
    [commitHistoryStore, cloudSignedIn, savePendingDeletes]
  );

  const handleRenameHistory = useCallback((id: string, title: string) => {
    const currentStore = historyStoreRef.current;
    const updatedStore = renameEntry(currentStore, id, title);
    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((item) => item.id === id);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }
  }, [syncCloudEntry, commitHistoryStore]);

  const handleUpdateEntryCategory = useCallback(
    (id: string, category: string) => {
      const currentStore = historyStoreRef.current;
      const updatedStore = updateEntryCategory(currentStore, id, category);
      commitHistoryStore(updatedStore);

      const updatedEntry = updatedStore.entries.find((item) => item.id === id);
      if (updatedEntry) {
        syncCloudEntry(updatedEntry);
      }

      if (historyStoreRef.current.activeId === id) {
        setData((current) => (current ? { ...current, category } : current));
      }
    },
    [syncCloudEntry, commitHistoryStore]
  );

  const handleUpdateCategory = useCallback(
    (category: string) => {
      const activeId = historyStoreRef.current.activeId;
      if (!activeId) return;
      handleUpdateEntryCategory(activeId, category);
    },
    [handleUpdateEntryCategory]
  );

  const patchActiveApplication = useCallback(
    (application: ApplicationArtifactV1) => {
      setData((current) => (current ? { ...current, application } : current));
      const activeId = historyStoreRef.current.activeId;
      if (!activeId) return;
      const currentStore = historyStoreRef.current;
      const activeEntry = currentStore.entries.find((entry) => entry.id === activeId);
      if (!activeEntry) return;
      const prevData = (activeEntry.session.data || {}) as ActionMapData;
      const nextData = { ...prevData, application };
      const nextSession = sessionWithSemanticProgress(
        { ...activeEntry.session, data: nextData },
        nextData
      );
      const updatedStore = updateActiveSession(currentStore, nextSession);
      commitHistoryStore(updatedStore);
      const updatedEntry = updatedStore.entries.find((e) => e.id === activeId);
      if (updatedEntry) syncCloudEntry(updatedEntry);
    },
    [commitHistoryStore, syncCloudEntry]
  );

  const openApplicationContextEditor = useCallback(() => {
    if (data?.application?.context) {
      setApplicationContext(data.application.context);
    }
    setApplicationContextEditorOpen(true);
  }, [data?.application?.context]);

  const closeApplicationContextEditor = useCallback(() => {
    setApplicationContextEditorOpen(false);
  }, []);

  const getActiveMapMeta = useCallback(() => {
    const activeId =
      historyStoreRef.current.activeId || inlineResultEntryIdRef.current || '';
    const entry = historyStoreRef.current.entries.find((e) => e.id === activeId);
    return {
      mapId: activeId,
      sourceId: entry?.sourceMeta?.sourceId,
      sourceVersionId: entry?.sourceMeta?.sourceVersionId,
      contentHash:
        entry?.sourceMeta?.contentHash ||
        data?.application?.contentHash ||
        data?.understanding?.contentHash,
    };
  }, [data?.application?.contentHash, data?.understanding?.contentHash]);

  const startActiveApplicationAction = useCallback(async () => {
    if (!data?.application) return;
    const started = startApplicationAction(data.application);
    if (!started) {
      setError('No se pudo empezar la acción con este plan.');
      return;
    }
    // Local session + history first (overlays). Cloud uses execution RPC only.
    patchActiveApplication(started);
    hapticCommit();

    const authSnap = activeAuthRef.current.getSnapshot();
    const meta = getActiveMapMeta();
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!authSnap?.accessToken || !authSnap.userId || !meta.mapId || !supabaseUrl || !anonKey) {
      return;
    }
    const core = toImmutableApplicationArtifact(started);
    const digest =
      applicationPlanDigestRef.current[meta.mapId] || applicationPlanDigest(core);
    const result = await persistApplicationExecutionWithUserJwt({
      accessToken: authSnap.accessToken,
      supabaseUrl,
      supabaseAnonKey: anonKey,
      ownerId: authSnap.userId,
      mapId: meta.mapId,
      sourceId: meta.sourceId,
      sourceVersionId: meta.sourceVersionId,
      application: core,
      planDigest: digest,
      startedAt: started.plan.startedAt,
      isCurrent: () =>
        activeAuthRef.current.isCurrent(authSnap.epoch, authSnap.userId),
    });
    if (result.ok === false && result.code !== 'APPLICATION_AUTH_STALE') {
      upsertPendingApplicationOp(authSnap.userId, {
        kind: 'execution',
        mapId: meta.mapId,
        planDigest: digest,
        startedAt: started.plan.startedAt,
        sourceId: meta.sourceId,
        sourceVersionId: meta.sourceVersionId,
        contentHash: meta.contentHash,
      });
      setPendingApplicationSyncByMapId((prev) => ({ ...prev, [meta.mapId]: true }));
      setError(APPLICATION_EXECUTION_SYNC_PENDING_MESSAGE);
    } else if (result.ok) {
      removePendingApplicationOp(authSnap.userId, 'execution', meta.mapId, {
        startedAt: started.plan.startedAt,
        planDigest: digest,
      });
    }
  }, [data?.application, getActiveMapMeta, patchActiveApplication]);

  const replanActiveApplication = useCallback(
    async (ctx: ApplicationContextV1, assumptionEdits?: Record<string, string>) => {
      if (!data?.application || !data.evidence) {
        setError('Falta evidencia local para replanificar sin regenerar la fuente.');
        return;
      }
      const previousArtifact = data.application;
      const meta = getActiveMapMeta();
      if (!meta.mapId) {
        setError('No hay mapa activo para replanificar.');
        return;
      }

      const authSnap = activeAuthRef.current.getSnapshot();
      const userId = authSnap?.userId ?? null;

      // Restore CAS digest from durable store into memory if needed.
      if (userId) {
        const stored = getActivePlanDigest(userId, meta.mapId);
        if (stored) applicationPlanDigestRef.current[meta.mapId] = stored;
      }

      const result = await replanApplicationFromEvidence({
        previous: previousArtifact,
        baseMap: data,
        evidence: data.evidence as EvidenceArtifact,
        context: ctx,
        ownerId: userId ?? undefined,
      });
      if (result.ok === false) {
        setError(result.message || 'No se pudo adaptar con el nuevo contexto.');
        return;
      }
      let proposed = result.artifact;
      if (assumptionEdits && Object.keys(assumptionEdits).length) {
        const edited = applyEditableAssumptionTexts(proposed, assumptionEdits);
        if (!edited) {
          setError('Un supuesto no es editable o el id no pertenece al plan.');
          return;
        }
        proposed = edited;
      }

      const stagedOrErr = buildStagedReplan({
        mapId: meta.mapId,
        previousArtifact,
        proposedArtifact: proposed,
        userId,
        memoryDigest: applicationPlanDigestRef.current[meta.mapId] ?? null,
        sourceId: meta.sourceId,
        sourceVersionId: meta.sourceVersionId,
      });
      if ('error' in stagedOrErr) {
        setError(stagedOrErr.error);
        return;
      }
      const staged = stagedOrErr;

      // Guest (or offline without auth): consolidate locally without cloud.
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!authSnap?.accessToken || !authSnap.userId || !supabaseUrl || !anonKey) {
        const guest = consolidateGuestReplan(staged);
        if (guest.status === 'consolidated') {
          setApplicationContext(ctx);
          setData({ ...result.map, application: guest.artifact, evidence: data.evidence });
          patchActiveApplication(guest.artifact);
          applicationPlanDigestRef.current[meta.mapId] = guest.planDigest;
          setApplicationContextEditorOpen(false);
          setStagedReplan(null);
          stagedReplanRef.current = null;
          setError(null);
          hapticSuccess();
        }
        return;
      }

      const cloud = await attemptCloudReplan({
        staged,
        auth: {
          accessToken: authSnap.accessToken,
          supabaseUrl,
          supabaseAnonKey: anonKey,
        },
        ownerId: authSnap.userId,
        confirmReplace: false,
        isCurrent: () =>
          activeAuthRef.current.isCurrent(authSnap.epoch, authSnap.userId),
      });

      if (cloud.status === 'aborted') {
        // A→B: discard P2; do not mutate B.
        setStagedReplan(null);
        stagedReplanRef.current = null;
        setApplicationContextEditorOpen(false);
        setError(null);
        return;
      }

      if (cloud.status === 'consolidated') {
        setApplicationContext(ctx);
        setData({ ...result.map, application: cloud.artifact, evidence: data.evidence });
        patchActiveApplication(cloud.artifact);
        applicationPlanDigestRef.current[meta.mapId] = cloud.planDigest;
        setActivePlanDigest(authSnap.userId, meta.mapId, cloud.planDigest);
        removePendingApplicationOp(authSnap.userId, 'replan', meta.mapId, {
          planDigest: staged.proposedDigest,
        });
        setStagedReplan(null);
        stagedReplanRef.current = null;
        setApplicationContextEditorOpen(false);
        setError(null);
        hapticSuccess();
        return;
      }

      if (cloud.status === 'requires_confirmation') {
        // Keep P1 active. Stage P2 for dialog — not a network pending.
        stagedReplanRef.current = cloud.staged;
        setStagedReplan(cloud.staged);
        setApplicationContext(ctx);
        setApplicationContextEditorOpen(false);
        setError(null);
        upsertPendingApplicationOp(authSnap.userId, {
          kind: 'replan',
          mapId: meta.mapId,
          planDigest: cloud.staged.proposedDigest,
          previousDigest: cloud.staged.previousDigest,
          confirmReplace: false,
          awaitingConfirmation: true,
          immutableArtifact: cloud.staged.proposedArtifact,
          sourceId: meta.sourceId,
          sourceVersionId: meta.sourceVersionId,
          contentHash: cloud.staged.proposedArtifact.contentHash,
        });
        return;
      }

      if (cloud.status === 'conflict') {
        setStagedReplan(null);
        stagedReplanRef.current = null;
        setError(cloud.message);
        return;
      }

      if (cloud.status === 'auth_stale') {
        setStagedReplan(null);
        stagedReplanRef.current = null;
        return;
      }

      // Network / other — keep P1, queue exact P2 for retry (not confirmation).
      upsertPendingApplicationOp(authSnap.userId, {
        kind: 'replan',
        mapId: meta.mapId,
        planDigest: staged.proposedDigest,
        previousDigest: staged.previousDigest,
        confirmReplace: false,
        awaitingConfirmation: false,
        immutableArtifact: staged.proposedArtifact,
        sourceId: meta.sourceId,
        sourceVersionId: meta.sourceVersionId,
        contentHash: staged.proposedArtifact.contentHash,
      });
      setPendingApplicationSyncByMapId((prev) => ({ ...prev, [meta.mapId]: true }));
      setError(pendingApplicationBannerMessage('replan'));
      setApplicationContextEditorOpen(false);
    },
    [data, getActiveMapMeta, patchActiveApplication]
  );

  const cancelStagedReplan = useCallback(() => {
    const staged = stagedReplanRef.current || stagedReplan;
    const authSnap = activeAuthRef.current.getSnapshot();
    if (staged && authSnap?.userId) {
      removePendingApplicationOp(authSnap.userId, 'replan', staged.mapId, {
        planDigest: staged.proposedDigest,
      });
    }
    stagedReplanRef.current = null;
    setStagedReplan(null);
    setStagedReplanBusy(false);
    setError(null);
  }, [stagedReplan]);

  const confirmStagedReplanReplace = useCallback(async () => {
    const staged = stagedReplanRef.current || stagedReplan;
    if (!staged) return;
    const authSnap = activeAuthRef.current.getSnapshot();
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!authSnap?.accessToken || !authSnap.userId || !supabaseUrl || !anonKey) {
      // Guest path should not reach confirm dialog; consolidate if somehow staged.
      const guest = consolidateGuestReplan(staged);
      if (guest.status === 'consolidated') {
        setData((current) =>
          current ? { ...current, application: guest.artifact } : current
        );
        patchActiveApplication(guest.artifact);
        applicationPlanDigestRef.current[staged.mapId] = guest.planDigest;
        cancelStagedReplan();
      }
      return;
    }

    setStagedReplanBusy(true);
    const cloud = await attemptCloudReplan({
      staged,
      auth: {
        accessToken: authSnap.accessToken,
        supabaseUrl,
        supabaseAnonKey: anonKey,
      },
      ownerId: authSnap.userId,
      confirmReplace: true,
      isCurrent: () =>
        activeAuthRef.current.isCurrent(authSnap.epoch, authSnap.userId),
    });
    setStagedReplanBusy(false);

    if (cloud.status === 'aborted') {
      cancelStagedReplan();
      return;
    }

    if (cloud.status === 'consolidated') {
      setData((current) =>
        current ? { ...current, application: cloud.artifact } : current
      );
      patchActiveApplication(cloud.artifact);
      applicationPlanDigestRef.current[staged.mapId] = cloud.planDigest;
      setActivePlanDigest(authSnap.userId, staged.mapId, cloud.planDigest);
      removePendingApplicationOp(authSnap.userId, 'replan', staged.mapId, {
        planDigest: staged.proposedDigest,
      });
      stagedReplanRef.current = null;
      setStagedReplan(null);
      setError(null);
      hapticSuccess();
      return;
    }

    if (cloud.status === 'conflict') {
      cancelStagedReplan();
      setError(cloud.message);
      return;
    }

    if (cloud.status === 'pending_sync') {
      upsertPendingApplicationOp(authSnap.userId, {
        kind: 'replan',
        mapId: staged.mapId,
        planDigest: staged.proposedDigest,
        previousDigest: staged.previousDigest,
        confirmReplace: true,
        awaitingConfirmation: false,
        immutableArtifact: staged.proposedArtifact,
        sourceId: staged.sourceId,
        sourceVersionId: staged.sourceVersionId,
        contentHash: staged.proposedArtifact.contentHash,
      });
      setPendingApplicationSyncByMapId((prev) => ({ ...prev, [staged.mapId]: true }));
      setError(pendingApplicationBannerMessage('replan'));
      stagedReplanRef.current = null;
      setStagedReplan(null);
    }
  }, [stagedReplan, cancelStagedReplan, patchActiveApplication]);

  const submitActiveApplicationReview = useCallback(
    async (args: {
      outcome: ApplicationReviewOutcome;
      privateNote?: string;
      failedAssumptionId?: string;
      wantsAdjust: boolean;
      wantsRepeat: boolean;
    }): Promise<'ok' | 'pending' | 'error'> => {
      if (!data?.application) return 'error';
      const review = buildApplicationReview({
        artifact: data.application,
        ...args,
      });
      const next = attachApplicationReview(data.application, review);
      if (!next) {
        setError('La revisión no es válida para este plan.');
        return 'error';
      }
      patchActiveApplication(next);

      const authSnap = activeAuthRef.current.getSnapshot();
      const meta = getActiveMapMeta();
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!authSnap?.accessToken || !authSnap.userId || !meta.mapId || !supabaseUrl || !anonKey) {
        return 'ok';
      }
      const core = toImmutableApplicationArtifact(next);
      const digest =
        applicationPlanDigestRef.current[meta.mapId] || applicationPlanDigest(core);
      const result = await persistApplicationReviewWithUserJwt({
        accessToken: authSnap.accessToken,
        supabaseUrl,
        supabaseAnonKey: anonKey,
        ownerId: authSnap.userId,
        mapId: meta.mapId,
        sourceId: meta.sourceId,
        sourceVersionId: meta.sourceVersionId,
        application: core,
        planDigest: digest,
        review: next.review!,
        isCurrent: () =>
          activeAuthRef.current.isCurrent(authSnap.epoch, authSnap.userId),
      });
      if (result.ok === true) {
        removePendingApplicationOp(authSnap.userId, 'review', meta.mapId, {
          reviewId: next.review!.id,
          planDigest: digest,
        });
        setPendingApplicationReviewSyncByMapId((prev) => {
          if (!prev[meta.mapId]) return prev;
          const n = { ...prev };
          delete n[meta.mapId];
          return n;
        });
        setError(null);
        return 'ok';
      }
      if (result.code === 'APPLICATION_AUTH_STALE') return 'error';
      upsertPendingApplicationOp(authSnap.userId, {
        kind: 'review',
        mapId: meta.mapId,
        planDigest: digest,
        review: next.review!,
        sourceId: meta.sourceId,
        sourceVersionId: meta.sourceVersionId,
      });
      setPendingApplicationReviewSyncByMapId((prev) => ({ ...prev, [meta.mapId]: true }));
      setError(APPLICATION_REVIEW_SYNC_PENDING_MESSAGE);
      return 'pending';
    },
    [data?.application, getActiveMapMeta, patchActiveApplication]
  );

  const handlePersistApplicationSync = useCallback(
    async (mapIdArg?: string) => {
      if (isStreamGenerating) return;
      const authSnap = activeAuthRef.current.getSnapshot();
      if (!authSnap?.accessToken || !authSnap.userId) {
        setError('Inicia sesión para sincronizar el plan.');
        return;
      }
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (!supabaseUrl || !anonKey) {
        setError(APPLICATION_SYNC_PENDING_MESSAGE);
        return;
      }
      const mapId =
        mapIdArg ||
        historyStoreRef.current.activeId ||
        inlineResultEntryIdRef.current ||
        '';
      const getApplicationForMap = (id: string) => {
        const entry = historyStoreRef.current.entries.find((e) => e.id === id);
        const app = (entry?.session.data as ActionMapData | undefined)?.application;
        return app ?? (id === mapId ? data?.application ?? null : null);
      };

      const flush = await flushPendingApplicationOps(
        authSnap.userId,
        {
          accessToken: authSnap.accessToken,
          supabaseUrl,
          supabaseAnonKey: anonKey,
        },
        {
          getApplicationForMap,
          isCurrent: () =>
            activeAuthRef.current.isCurrent(authSnap.epoch, authSnap.userId),
        }
      );

      const still = loadPendingApplicationOps(authSnap.userId);
      setPendingApplicationSyncByMapId(
        Object.fromEntries(
          still
            .filter((p) => p.kind === 'plan' || p.kind === 'replan' || p.kind === 'execution')
            .map((p) => [p.mapId, true as const])
        )
      );
      setPendingApplicationReviewSyncByMapId(
        Object.fromEntries(
          still.filter((p) => p.kind === 'review').map((p) => [p.mapId, true as const])
        )
      );
      if (flush.failed.length) {
        const kind = flush.failed[0]!.kind;
        setError(pendingApplicationBannerMessage(kind));
        return;
      }
      setError(null);
    },
    [data?.application, isStreamGenerating]
  );

  // Unified reconnect: one ordered pass per owner+map (source → evidence → progress).
  // Application flush stays separate (S06) and does not share the ordered gate.
  useEffect(() => {
    const onActive = () => {
      const snap = activeAuthRef.current.getSnapshot();
      const mapId =
        inlineResultEntryIdRef.current || historyStoreRef.current.activeId || '';
      if (!snap?.userId || !mapId) return;
      if (inlineGenerationStatusRef.current === 'generating' || inlineGenerationStatusRef.current === 'partial') return;
      void handleOrderedPersistRetry('auto');
      void handlePersistApplicationSync(mapId);
    };
    const appSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') onActive();
    });
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) return;
      onActive();
    });
    return () => {
      appSub.remove();
      unsubNet();
    };
  }, [handleOrderedPersistRetry, handlePersistApplicationSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background' && state !== 'inactive') return;
      const entry =
        historyStoreRef.current.entries.find(
          (item) => item.id === historyStoreRef.current.activeId
        ) ?? null;
      if (!entry || entry.session?.isComplete) return;
      if (entry.kind === 'chat') return;
      void scheduleIncompleteReminder({ entryId: entry.id, title: entry.title });
    });
    return () => sub.remove();
  }, []);

  const handlePinHistory = useCallback((id: string) => {
    const currentStore = historyStoreRef.current;
    const updatedStore = togglePinEntry(currentStore, id);
    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((item) => item.id === id);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }

    hapticToggle(Boolean(updatedEntry?.pinned));
  }, [syncCloudEntry, commitHistoryStore]);

  const handleCompleteMap = useCallback(() => {
    setIsComplete(true);
    setEssentialsReview(false);
    persistSessionState(currentStep, true, viewAll);
    const activeId = historyStoreRef.current.activeId;
    if (activeId) {
      void cancelIncompleteReminder(activeId);
    }
  }, [currentStep, persistSessionState, viewAll]);

  const triggerCompletionCeremonyIfNeeded = useCallback((): boolean => {
    const activeId = historyStoreRef.current.activeId;
    if (!activeId) return false;

    const entry = historyStoreRef.current.entries.find((item) => item.id === activeId);
    if (!entry || entry.completionCeremonyShown) return false;

    hapticSuccess();
    void cancelIncompleteReminder(activeId);

    const updatedStore = markCompletionCeremonyShown(historyStoreRef.current, activeId);
    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((item) => item.id === activeId);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }

    return true;
  }, [commitHistoryStore, syncCloudEntry]);

  const enterCompletedViewAll = useCallback(() => {
    setEssentialsReview(false);
    setViewAll(true);
    persistSessionState(currentStep, true, true);
  }, [currentStep, persistSessionState]);

  const downloadPdfForMap = useCallback(async (mapId: string, mapData: ActionMapData) => {
    if (isPdfGeneratingRef.current) return;

    const filename = `${mapData.title || 'nucleo-cheatsheet'}.pdf`.replace(/[^\w.-]+/g, '-');
    const directory = cacheDirectory;
    if (!directory) {
      setError('No se pudo acceder al almacenamiento local.');
      return;
    }
    const uri = `${directory}${filename}`;

    isPdfGeneratingRef.current = true;
    setIsPdfGenerating(true);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token;
      const llmHeaders = await buildLlmRequestHeaders(token);

      const prepareResponse = await fetchWithTimeout(
        apiUrl(`/api/maps/${mapId}/cheatsheet.prepare`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...llmHeaders,
          },
          body: JSON.stringify({ map: mapData }),
        },
        {
          timeoutMs: 15000,
          timeoutMessage: 'No se ha podido preparar el PDF a tiempo. Comprueba tu conexión e inténtalo de nuevo.',
        }
      );

      if (!prepareResponse.ok) {
        const err = (await prepareResponse.json().catch(() => ({}))) as { error?: string };
        console.error('Prepare PDF failed:', prepareResponse.status, err);
        throw new Error(err?.error || 'No se pudo preparar la ficha PDF.');
      }

      const headers: Record<string, string> = { ...llmHeaders };

      const result = await downloadAsync(
        apiUrl(`/api/maps/${mapId}/cheatsheet.pdf`),
        uri,
        { headers }
      );

      if (result.status >= 400) {
        let serverMessage = 'No se pudo generar la ficha PDF.';
        try {
          const errorText = await readAsStringAsync(uri);
          const parsed = JSON.parse(errorText) as { error?: string };
          if (typeof parsed?.error === 'string') serverMessage = parsed.error;
        } catch {
          // Keep default serverMessage when the error body is not JSON.
        }
        await deleteAsync(uri, { idempotent: true });
        throw new Error(serverMessage);
      }

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        throw new Error('La función de compartir no está disponible en este dispositivo.');
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: filename,
      });
    } catch (err) {
      console.error('Error al generar o compartir el PDF:', err);
      setError(err instanceof Error ? err.message : 'No se pudo generar la ficha PDF.');
      hapticError();
    } finally {
      isPdfGeneratingRef.current = false;
      setIsPdfGenerating(false);
    }
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const mapId = historyStore.activeId;
    if (!data || !mapId) return;
    await downloadPdfForMap(mapId, data);
  }, [data, downloadPdfForMap, historyStore.activeId]);

  const handleDownloadPdfForEntry = useCallback(
    async (entryId: string) => {
      const entry = historyStoreRef.current.entries.find((item) => item.id === entryId);
      if (!entry) return;
      const mapData = normalizeMapData(entry.session.data);
      if (!mapData) return;
      await downloadPdfForMap(entryId, mapData);
    },
    [downloadPdfForMap]
  );

  const activeSyncMapId =
    inlineResultEntryIdRef.current || historyStore.activeId || null;
  const sourceSyncPending = Boolean(
    activeSyncMapId && pendingSyncByMapId[activeSyncMapId]
  );
  const evidenceSyncPending = Boolean(
    activeSyncMapId && pendingEvidenceSyncByMapId[activeSyncMapId]
  );
  const progressSyncPending = Boolean(
    activeSyncMapId && pendingProgressSyncByMapId[activeSyncMapId]
  );
  const canRetryPersistSync =
    sourceSyncPending &&
    inlineGenerationStatus !== 'generating' &&
    inlineGenerationStatus !== 'partial' &&
    !isStreamGenerating;
  const canRetryEvidenceSync =
    evidenceSyncPending &&
    inlineGenerationStatus !== 'generating' &&
    inlineGenerationStatus !== 'partial' &&
    !isStreamGenerating;
  const canRetryProgressSync =
    progressSyncPending &&
    inlineGenerationStatus !== 'generating' &&
    inlineGenerationStatus !== 'partial' &&
    !isStreamGenerating;
  const applicationSyncPending = Boolean(
    activeSyncMapId && pendingApplicationSyncByMapId[activeSyncMapId]
  );
  const applicationReviewSyncPending = Boolean(
    activeSyncMapId && pendingApplicationReviewSyncByMapId[activeSyncMapId]
  );
  const canRetryApplicationSync =
    (applicationSyncPending || applicationReviewSyncPending) &&
    inlineGenerationStatus !== 'generating' &&
    inlineGenerationStatus !== 'partial' &&
    !isStreamGenerating;

  const activeEntryForSync = activeSyncMapId
    ? historyStore.entries.find((e) => e.id === activeSyncMapId)
    : undefined;
  const evidenceBlockedBySource = Boolean(
    evidenceSyncPending &&
      activeSyncMapId &&
      (sourceSyncPending ||
        !activeEntryForSync?.sourceMeta?.sourceId ||
        !activeEntryForSync?.sourceMeta?.sourceVersionId)
  );
  const lastSyncFailureCode = resolveActiveSyncFailureCode({
    failure: syncFailure,
    ownerId: cloudUserId,
    mapId: activeSyncMapId,
  });
  const syncNoticeRaw = deriveSyncNotice({
    sourcePending: sourceSyncPending,
    evidencePending: evidenceSyncPending,
    progressPending: progressSyncPending,
    applicationPending: applicationSyncPending || applicationReviewSyncPending,
    sourceSaving: resolveActiveSyncSaving({
      saving: sourceSaving,
      ownerId: cloudUserId,
      mapId: activeSyncMapId,
    }),
    evidenceSaving: resolveActiveSyncSaving({
      saving: evidenceSaving,
      ownerId: cloudUserId,
      mapId: activeSyncMapId,
    }),
    retryingKind: null,
    lastFailureCode: lastSyncFailureCode,
    evidenceBlockedBySource,
    sourceCloudConfirmed:
      activeEntryForSync?.sourceMeta?.persistStatus === 'cloud',
    evidenceApplicable: Boolean(
      (activeEntryForSync?.session?.data as ActionMapData | undefined)?.evidence &&
        (activeEntryForSync?.session?.data as ActionMapData | undefined)?.evidence
          ?.status === 'complete'
    ),
    evidenceCloudConfirmed: Boolean(
      activeSyncMapId && evidenceCloudConfirmedByMapId[activeSyncMapId]
    ),
  });
  const syncNotice =
    syncNoticeRaw && dismissedSyncNoticeKey === syncNoticeRaw.liveRegionKey
      ? null
      : syncNoticeRaw;

  useEffect(() => {
    if (!syncNoticeRaw) setDismissedSyncNoticeKey(null);
  }, [syncNoticeRaw]);

  const dismissSyncNotice = useCallback(() => {
    if (syncNoticeRaw?.liveRegionKey) {
      setDismissedSyncNoticeKey(syncNoticeRaw.liveRegionKey);
    }
  }, [syncNoticeRaw?.liveRegionKey]);

  const value = useMemo(

    () => ({
      phase,
      setPhase,
      inputText,
      setInputText,
      pastedText,
      handleComposerTextChange,
      removePastedText,
      intent,
      setIntent,
      applicationContext,
      setApplicationContext,
      patchActiveApplication,
      applicationContextEditorOpen,
      openApplicationContextEditor,
      closeApplicationContextEditor,
      startActiveApplicationAction,
      replanActiveApplication,
      confirmStagedReplanReplace,
      cancelStagedReplan,
      stagedReplanConfirmOpen: Boolean(stagedReplan),
      submitActiveApplicationReview,
      handlePersistApplicationSync,
      applicationSyncPending,
      applicationReviewSyncPending,
      canRetryApplicationSync,
      error,
      setError,
      data,
      historyStore,
      applyGeneratedCover,
      currentStep,
      isComplete,
      viewAll,
      layer0Passed,
      layer0CheckedActionIds,
      passLayer0,
      toggleLayer0Action,
      historyOpen,
      setHistoryOpen,
      openHistoryDrawer,
      closeHistoryDrawer,
      toggleHistoryDrawer,
      chatOpen,
      setChatOpen,
      authOpen,
      setAuthOpen,
      openAuthSheet,
      betaQuotaOpen,
      setBetaQuotaOpen,
      paywallOpen,
      setPaywallOpen,
      openPaywall,
      cloudUserId,
      cloudUserEmail,
      cloudUserDisplayName,
      cloudUserAvatarUrl,
      cloudSignedIn,
      isPro,
      isCloudSyncConfigured,
      uploadedFile,
      attachMenuOpen,
      setAttachMenuOpen,
      modelPreference,
      setModelPreference,
      depthPreference,
      setDepthPreference,
      generationMode,
      setGenerationMode,
      homeSurface,
      setHomeSurface,
      totalSteps,
      canSubmit,
      hideTextInput,
      composerPlaceholder,
      hasAnyNucleo,
      continueEntry: visibleContinueEntry,
      resumeSummary,
      resumeBannerVisible,
      dismissResumeBanner,
      dismissContinueChip,
      progressLabel,
      stepProgress,
      goToStep,
      syncReadingStep,
      toggleViewMode,
      handleCancelLoading,
      handlePickImage,
      handlePickCamera,
      handlePickFile,
      handleLoadQaMultipagePdf,
      removeUploadedFile,
      handleTransform,
      handlePersistSourceSync,
      handlePersistEvidenceSync,
      handlePersistProgressSync,
      handleOrderedPersistRetry,
      syncNotice,
      lastSyncFailureCode,
      dismissSyncNotice,
      handleComposerSubmit,
      sourceSyncPending,
      evidenceSyncPending,
      progressSyncPending,
      canRetryPersistSync,
      canRetryEvidenceSync,
      canRetryProgressSync,
      pendingSyncByMapId,
      pendingEvidenceSyncByMapId,
      pendingProgressSyncByMapId,
      handleOpenDemoNucleo,
      devToolsEnabled,
      setDevToolsEnabled,
      editorialDemoPlan,
      openEditorialDemo,
      closeEditorialDemo,
      previewInlineGeneration,
      previewPreMapChat,
      previewLoadingScreen,
      previewNucleo,
      previewChatThinking,
      devPreviewGenerationActive,
      ...(__DEV__
        ? {
            devHistoryHidden,
            devHideHistory,
            devRestoreHistory,
          }
        : {}),
      handleNewMap,
      handleSelectHistory,
      beginContinueTransition,
      completeContinueTransitionHandoff,
      markContinueHandoffLayoutReady,
      registerContinueHandoffGlassTarget,
      notifyContinueHandoffGlassActive,
      finishContinueExpandTransition,
      finishContinueCollapseTransition,
      startReverseContinueTransition,
      canReverseContinueTransition,
      continueTransition,
      continueTransitionHandoff,
      continueHandoffPrewarm,
      handleDeleteHistory,
      handleRenameHistory,
      handleUpdateCategory,
      handleUpdateEntryCategory,
      handlePinHistory,
      handleCompleteMap,
      triggerCompletionCeremonyIfNeeded,
      essentialsReview,
      setEssentialsReview,
      handleDownloadPdf,
      handleDownloadPdfForEntry,
      enterCompletedViewAll,
      isStreamGenerating,
      isAnalyzingSource,
      collectionGenerationProgress,
      streamLoadPhase,
      streamProgressShared,
      loadingFadeOverlayActive,
      completeLoadingFadeOverlay,
      isPdfGenerating,
      transformIncomplete,
      dismissTransformIncomplete,
      persistComposerDraft,
      beginComposerEdit,
      handleSignOut,
      handleDeleteAccount,
      inlineGenerationStatus,
      inlineUserTurn,
      inlineAskAnswer,
      inlineAskPriorTurns,
      activeChatId: inlineAskChatId,
      inlineAskDisclaimer,
      inlineAskCtaLabel,
      inlineAskModelUsed,
      cancelInlineAutoOpen,
      registerInlineAutoOpenCancel,
      openInlineResult,
    }),
    [
      phase,
      inputText,
      pastedText,
      handleComposerTextChange,
      removePastedText,
      intent,
      setIntent,
      applicationContext,
      setApplicationContext,
      patchActiveApplication,
      applicationContextEditorOpen,
      openApplicationContextEditor,
      closeApplicationContextEditor,
      startActiveApplicationAction,
      replanActiveApplication,
      confirmStagedReplanReplace,
      cancelStagedReplan,
      stagedReplan,
      stagedReplanBusy,
      submitActiveApplicationReview,
      handlePersistApplicationSync,
      applicationSyncPending,
      applicationReviewSyncPending,
      canRetryApplicationSync,
      error,
      data,
      historyStore,
      applyGeneratedCover,
      currentStep,
      isComplete,
      viewAll,
      layer0Passed,
      layer0CheckedActionIds,
      passLayer0,
      toggleLayer0Action,
      historyOpen,
      setHistoryOpen,
      openHistoryDrawer,
      closeHistoryDrawer,
      toggleHistoryDrawer,
      chatOpen,
      authOpen,
      openAuthSheet,
      betaQuotaOpen,
      setBetaQuotaOpen,
      paywallOpen,
      openPaywall,
      cloudUserId,
      cloudUserEmail,
      cloudUserDisplayName,
      cloudUserAvatarUrl,
      cloudSignedIn,
      isPro,
      uploadedFile,
      attachMenuOpen,
      modelPreference,
      depthPreference,
      setDepthPreference,
      generationMode,
      setGenerationMode,
      homeSurface,
      setHomeSurface,
      totalSteps,
      canSubmit,
      hideTextInput,
      composerPlaceholder,
      hasAnyNucleo,
      visibleContinueEntry,
      resumeSummary,
      resumeBannerVisible,
      dismissResumeBanner,
      dismissContinueChip,
      progressLabel,
      stepProgress,
      goToStep,
      syncReadingStep,
      toggleViewMode,
      handleCancelLoading,
      handlePickImage,
      handlePickCamera,
      handlePickFile,
      handleLoadQaMultipagePdf,
      removeUploadedFile,
      handleTransform,
      handlePersistSourceSync,
      handlePersistEvidenceSync,
      handlePersistProgressSync,
      handleOrderedPersistRetry,
      syncNotice,
      lastSyncFailureCode,
      dismissSyncNotice,
      handleComposerSubmit,
      sourceSyncPending,
      evidenceSyncPending,
      progressSyncPending,
      canRetryPersistSync,
      canRetryEvidenceSync,
      canRetryProgressSync,
      pendingSyncByMapId,
      pendingEvidenceSyncByMapId,
      pendingProgressSyncByMapId,
      handleOpenDemoNucleo,
      devToolsEnabled,
      setDevToolsEnabled,
      editorialDemoPlan,
      openEditorialDemo,
      closeEditorialDemo,
      devHistoryHidden,
      devHideHistory,
      devRestoreHistory,
      previewInlineGeneration,
      previewPreMapChat,
      devPreviewGenerationActive,
      previewLoadingScreen,
      previewNucleo,
      previewChatThinking,
      handleNewMap,
      handleSelectHistory,
      beginContinueTransition,
      completeContinueTransitionHandoff,
      markContinueHandoffLayoutReady,
      registerContinueHandoffGlassTarget,
      notifyContinueHandoffGlassActive,
      finishContinueExpandTransition,
      finishContinueCollapseTransition,
      startReverseContinueTransition,
      canReverseContinueTransition,
      continueTransition,
      continueTransitionHandoff,
      continueHandoffPrewarm,
      handleDeleteHistory,
      handleRenameHistory,
      handleUpdateCategory,
      handleUpdateEntryCategory,
      handlePinHistory,
      handleCompleteMap,
      triggerCompletionCeremonyIfNeeded,
      essentialsReview,
      handleDownloadPdf,
      handleDownloadPdfForEntry,
      enterCompletedViewAll,
      isStreamGenerating,
      isAnalyzingSource,
      collectionGenerationProgress,
      streamLoadPhase,
      streamProgressShared,
      loadingFadeOverlayActive,
      completeLoadingFadeOverlay,
      isPdfGenerating,
      transformIncomplete,
      dismissTransformIncomplete,
      persistComposerDraft,
      beginComposerEdit,
      handleSignOut,
      handleDeleteAccount,
      inlineGenerationStatus,
      inlineUserTurn,
      inlineAskAnswer,
      inlineAskPriorTurns,
      inlineAskChatId,
      inlineAskDisclaimer,
      inlineAskCtaLabel,
      inlineAskModelUsed,
      cancelInlineAutoOpen,
      registerInlineAutoOpenCancel,
      openInlineResult,
    ]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
      {stagedReplan ? (
        <React.Suspense fallback={null}>
          <ApplicationReplanConfirmDialog
            visible
            started={stagedReplan.started}
            hasReview={stagedReplan.hasReview}
            busy={stagedReplanBusy}
            onKeepCurrent={cancelStagedReplan}
            onReplace={() => {
              void confirmStagedReplanReplace();
            }}
          />
        </React.Suspense>
      ) : null}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) throw new Error('useAppSession must be used within AppSessionProvider');
  return context;
}
