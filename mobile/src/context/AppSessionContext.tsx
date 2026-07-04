import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AccessibilityInfo } from 'react-native';
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { ActionMapData, MapIntent, SourceAnalysisResponse, SourceType, TransformRequest } from '../logic/contracts';
import {
  deleteCloudHistoryEntry,
  migrateLocalHistory,
  pullCloudHistory,
  pushHistoryEntry,
  signOut,
} from '../logic/cloudHistory';
import { toCloudUserProfile } from '../logic/cloudUserProfile';
import {
  createCollection,
  createEntry,
  deleteEntry,
  getActiveEntry,
  loadHistory,
  registerNucleoInCollection,
  renameEntry,
  saveHistory,
  setActiveId,
  togglePinEntry,
  updateActiveSession,
  updateEntryCategory,
  markCompletionCeremonyShown,
  type HistoryEntry,
  type HistoryStore,
} from '../logic/history';
import {
  analyzeTransformSource,
  buildCollectionPartBody,
  promptCollectionSplit,
} from '../logic/collectionAnalyze';
import {
  formatReadingProgressLabel,
  isLastStepInReadingSection,
} from '@shared/nucleoPipeline';
import { isProUser } from '@shared/proEntitlement';
import { normalizeMapData } from '../logic/mapData';
import {
  getInitialModelPreference,
  saveModelPreference,
  type ModelPreference,
} from '../logic/modelPreference';
import {
  getInitialDepthPreference,
  saveDepthPreference,
  type DepthPreference,
} from '../logic/depthPreference';
import {
  pickFileAttachment,
  pickImageFromCamera,
  pickImageFromLibrary,
  type UploadedFile,
} from '../logic/attachments';
import { detectUrlInput, type TransformSourceKind } from '../logic/urlInput';
import {
  buildComposerSourceKey,
  suggestIntentFromSource,
} from '../logic/intentPreselection';
import {
  clearComposerDraft,
  loadComposerDraft,
  saveComposerDraft,
} from '../logic/composerDraft';
import { shouldCollapsePastedText } from '../logic/composerText';
import { DEMO_NUCLEO_DATA, DEMO_NUCLEO_ID } from '../data/demoNucleo';
import {
  isIntroReadyForTransition,
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
  TRANSFORM_IDLE_TIMEOUT_MESSAGE,
} from '../logic/transformStream';
import { apiUrl } from '../logic/apiBase';
import { isCloudSyncConfigured, supabase } from '../logic/supabase';
import { fetchWithTimeout } from '../logic/network';
import {
  CONTINUE_IMMEDIATE_BACK_MS,
  type ContinueChipRect,
  type ContinueTransitionSnapshot,
} from '../logic/continueTransition';
import { debugTransitionLog } from '../logic/debugTransitionLog';

export type AppPhase = 'input' | 'loading' | 'result';

const MAX_SYNCED_ENTRIES = 30;
/** The loading bar animates to 100% (400ms fill) before the phase swaps. */
const INTRO_TRANSITION_BAR_MS = 520;
const OFFLINE_TRANSFORM_MESSAGE = 'Sin conexión. Comprueba tu red y vuelve a intentarlo.';
const GENERIC_TRANSFORM_ERROR = 'No se pudo procesar la fuente.';

async function isDeviceOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === false || state.isInternetReachable === false;
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

function resolveTransformSourceKind(
  _uploadedFile: UploadedFile | null,
  urlDetection: ReturnType<typeof detectUrlInput> | null
): TransformSourceKind {
  if (urlDetection?.kind === 'youtube') return 'youtube';
  if (urlDetection?.kind === 'link') return 'link';
  return 'text';
}

export function stepHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

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
  error: string | null;
  setError: (error: string | null) => void;
  data: ActionMapData | null;
  historyStore: HistoryStore;
  currentStep: number;
  isComplete: boolean;
  viewAll: boolean;
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
  paywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
  openPaywall: () => void;
  cloudUserEmail: string | null;
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
  totalSteps: number;
  canSubmit: boolean;
  hideTextInput: boolean;
  composerPlaceholder: string;
  hasAnyNucleo: boolean;
  continueEntry: HistoryEntry | null;
  dismissContinueChip: () => void;
  progressLabel: string;
  sectionCompleteCue: number | null;
  stepProgress: number;
  goToStep: (idx: number, fromViewAll?: boolean) => void;
  syncReadingStep: (step: number) => void;
  toggleViewMode: () => void;
  handleCancelLoading: () => void;
  handlePickImage: () => Promise<void>;
  handlePickCamera: () => Promise<void>;
  handlePickFile: () => Promise<void>;
  removeUploadedFile: () => void;
  handleTransform: () => Promise<void>;
  handleOpenDemoNucleo: () => void;
  devHistoryHidden?: boolean;
  devHideHistory?: () => void;
  devRestoreHistory?: () => void;
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
  collectionGenerationProgress: { completed: number; total: number } | null;
  streamLoadPhase: StreamLoadPhase;
  streamProgressShared: SharedValue<number>;
  loadingFadeOverlayActive: boolean;
  completeLoadingFadeOverlay: () => void;
  isPdfGenerating: boolean;
  transformIncomplete: boolean;
  dismissTransformIncomplete: () => void;
  persistComposerDraft: () => void;
  handleSignOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const initialHistory = useMemo(() => loadHistory(), []);
  const initialActive = useMemo(() => getActiveEntry(initialHistory), [initialHistory]);
  const initialActiveData = useMemo(
    () => (initialActive ? normalizeMapData(initialActive.session.data) : null),
    [initialActive]
  );

  const [phase, setPhase] = useState<AppPhase>(initialActiveData ? 'result' : 'input');
  const [inputText, setInputText] = useState('');
  const [pastedText, setPastedText] = useState<string | null>(null);
  const inputTextRef = useRef('');
  const [intent, setIntentState] = useState<MapIntent>(initialActiveData?.intent ?? 'understand');
  const [error, setError] = useState<string | null>(null);
  const [transformIncomplete, setTransformIncomplete] = useState(false);
  const [data, setData] = useState<ActionMapData | null>(initialActiveData);
  const [historyStore, setHistoryStore] = useState<HistoryStore>(initialHistory);
  const [currentStep, setCurrentStep] = useState(initialActive?.session.currentStep ?? 0);
  const [isComplete, setIsComplete] = useState(initialActive?.session.isComplete ?? false);
  const [viewAll, setViewAll] = useState(initialActive?.session.viewAll ?? false);
  const [historyOpen, setHistoryOpenState] = useState(false);
  const [dismissedContinueId, setDismissedContinueId] = useState<string | null>(null);
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
  const historyOpenRef = useRef(false);

  const openHistoryDrawer = useCallback(() => {
    if (historyOpenRef.current) return;
    historyOpenRef.current = true;
    stepHaptic();
    setHistoryOpenState(true);
  }, []);

  const closeHistoryDrawer = useCallback(() => {
    if (!historyOpenRef.current) return;
    historyOpenRef.current = false;
    stepHaptic();
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
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [cloudUserAvatarUrl, setCloudUserAvatarUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelPreference, setModelPreferenceState] = useState<ModelPreference>(() =>
    getInitialModelPreference()
  );
  const [depthPreference, setDepthPreferenceState] = useState<DepthPreference>(() =>
    getInitialDepthPreference()
  );
  const [essentialsReview, setEssentialsReview] = useState(false);
  const [sectionCompleteCue, setSectionCompleteCue] = useState<number | null>(null);
  const [isStreamGenerating, setIsStreamGenerating] = useState(false);
  const [collectionGenerationProgress, setCollectionGenerationProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [streamLoadPhase, setStreamLoadPhase] = useState<StreamLoadPhase>(0);
  const streamProgressShared = useSharedValue(0);
  const [loadingFadeOverlayActive, setLoadingFadeOverlayActive] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const streamProgressCapRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const phaseRef = useRef(phase);

  const abortControllerRef = useRef<AbortController | null>(null);
  const transformCancelledRef = useRef(false);
  const partialShownRef = useRef(false);
  const historyStoreRef = useRef(historyStore);
  const isPdfGeneratingRef = useRef(false);
  const sourceKeyRef = useRef('');
  const intentUserOverrideRef = useRef(false);
  const draftRestoredRef = useRef(false);

  const pendingDeletesRef = useRef<string[]>([]);
  const introTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'loading' && introTransitionTimeoutRef.current) {
      clearTimeout(introTransitionTimeoutRef.current);
      introTransitionTimeoutRef.current = null;
    }
  }, [phase]);

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
    if (!isStreamGenerating && phase !== 'loading' && !loadingFadeOverlayActive) return;

    const interval = setInterval(() => {
      if (reduceMotionRef.current) return;
      const current = streamProgressShared.value;
      const cap = streamProgressCapRef.current;
      if (current >= cap) return;
      const step = Math.max(0.35, (cap - current) * 0.055);
      streamProgressShared.value = Math.min(cap, current + step);
    }, 80);

    return () => clearInterval(interval);
  }, [isStreamGenerating, loadingFadeOverlayActive, phase, streamProgressShared]);

  const getPendingDeletes = useCallback((email: string): string[] => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const val = localStorage.getItem(`nucleo_pending_deletes:${normalizedEmail}`);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
      }
    } catch (err) {
      console.error('Error al cargar la cola de borrados pendientes:', err);
    }
    return [];
  }, []);

  const savePendingDeletes = useCallback((email: string, ids: string[]) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const deduplicated = Array.from(new Set(ids));
      localStorage.setItem(`nucleo_pending_deletes:${normalizedEmail}`, JSON.stringify(deduplicated));
    } catch (err) {
      console.error('Error al guardar la cola de borrados pendientes:', err);
    }
  }, []);

  const flushPendingDeletes = useCallback(async (email: string) => {
    const ids = getPendingDeletes(email);
    if (ids.length === 0) return;

    const remainingIds = [...ids];
    for (const id of ids) {
      try {
        await deleteCloudHistoryEntry(id);
        const index = remainingIds.indexOf(id);
        if (index > -1) {
          remainingIds.splice(index, 1);
        }
      } catch (err) {
        console.error(`Error al procesar eliminación pendiente de ${id}:`, err);
        break;
      }
    }
    pendingDeletesRef.current = remainingIds;
    savePendingDeletes(email, remainingIds);
  }, [getPendingDeletes, savePendingDeletes]);

  const commitHistoryStore = useCallback((updatedStore: HistoryStore) => {
    historyStoreRef.current = updatedStore;
    saveHistory(updatedStore);
    setHistoryStore(updatedStore);
  }, []);

  const pendingAuthRef = useRef(false);
  const cloudSignedIn = Boolean(cloudUserEmail);
  const isPro = useMemo(() => isProUser(cloudUserEmail), [cloudUserEmail]);

  const totalSteps = data?.steps.length ?? 0;
  const composerBodyText = pastedText?.trim() ?? inputText.trim();
  const canSubmit = Boolean(composerBodyText || uploadedFile);
  const hideTextInput = Boolean(uploadedFile?.isPdf || uploadedFile?.isVideo);
  const composerPlaceholder = uploadedFile?.isImage
    ? 'Añade una indicación (opcional)…'
    : uploadedFile?.isVideo
      ? 'Añade una indicación sobre el video (opcional)…'
      : uploadedFile
        ? 'Archivo adjunto listo para convertir'
        : 'Pega texto, un enlace o adjunta un archivo';

  const hasAnyNucleo = historyStore.entries.length > 0;

  const continueEntry = useMemo(
    () => historyStore.entries.find((entry) => !entry.session.isComplete) ?? null,
    [historyStore.entries]
  );

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
    intentUserOverrideRef.current = true;
    setIntentState(value);
    stepHaptic();
  }, []);

  const persistComposerDraft = useCallback(() => {
    if (!inputText.trim() && !uploadedFile && !pastedText) {
      clearComposerDraft();
      return;
    }
    saveComposerDraft({ inputText, uploadedFile, pastedText });
  }, [inputText, pastedText, uploadedFile]);

  const handleComposerTextChange = useCallback((text: string) => {
    const prev = inputTextRef.current;
    if (shouldCollapsePastedText(prev, text)) {
      setPastedText(text.trim());
      setInputText('');
      inputTextRef.current = '';
      return;
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
    if (currentStep === 0) return 'Introducción';
    return formatReadingProgressLabel(
      currentStep,
      totalSteps,
      data?.readingSections ?? null
    );
  }, [currentStep, data?.readingSections, isComplete, totalSteps, viewAll]);

  const stepProgress = useMemo(() => {
    if (isComplete || viewAll || !data || totalSteps === 0) return 0;
    if (currentStep === 0) return 0;
    return Math.round((currentStep / totalSteps) * 100);
  }, [currentStep, data, isComplete, totalSteps, viewAll]);

  const setModelPreference = useCallback((value: ModelPreference) => {
    setModelPreferenceState(value);
    saveModelPreference(value);
    stepHaptic();
  }, []);

  const setDepthPreference = useCallback((value: DepthPreference) => {
    setDepthPreferenceState(value);
    saveDepthPreference(value);
    stepHaptic();
  }, []);

  const saveStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type PendingPersist = {
    id: string;
    step: number;
    isComplete: boolean;
    viewAll: boolean;
  };
  const pendingPersistRef = useRef<PendingPersist | null>(null);

  const syncCloudEntry = useCallback((entry: HistoryEntry) => {
    if (!supabase || !cloudSignedIn) return;
    void pushHistoryEntry(entry).catch((err) => {
      console.error(`Error al sincronizar el mapa ${entry.id} en la nube:`, err);
    });
  }, [cloudSignedIn]);

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
      entry.session.viewAll === pending.viewAll
    ) {
      pendingPersistRef.current = null;
      return;
    }

    const now = Date.now();
    const entries = currentStore.entries.map((item) => {
      if (item.id !== pending.id) return item;

      const updatedSession = {
        ...item.session,
        currentStep: pending.step,
        isComplete: pending.isComplete,
        viewAll: pending.viewAll,
      };

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

  const persistSessionState = useCallback((step: number, complete: boolean, viewAllMode: boolean) => {
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
    };

    if (saveStepTimerRef.current) {
      clearTimeout(saveStepTimerRef.current);
    }

    saveStepTimerRef.current = setTimeout(() => {
      flushPendingSessionPersist();
    }, 800);
  }, [flushPendingSessionPersist]);

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
    if (key !== sourceKeyRef.current) {
      sourceKeyRef.current = key;
      intentUserOverrideRef.current = false;
    }
    if (intentUserOverrideRef.current) return;
    const detection =
      !uploadedFile && composerBodyText ? detectUrlInput(composerBodyText) : null;
    const suggested = suggestIntentFromSource(composerBodyText, uploadedFile, detection);
    setIntentState(suggested);
  }, [composerBodyText, inputText, pastedText, uploadedFile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        persistComposerDraft();
      }
    });
    return () => subscription.remove();
  }, [persistComposerDraft]);

  const openAuthSheet = useCallback(() => {
    pendingAuthRef.current = true;
    setHistoryOpen(false);
  }, []);

  const openPaywall = useCallback(() => {
    setPaywallOpen(true);
    Alert.alert(
      'Profundo llega con Pro',
      'La profundidad Profundo estará disponible con el plan Pro. Por ahora puedes usar Rápido y Estándar.'
    );
  }, []);

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

    const hydrateCloudHistory = async (user: Parameters<typeof toCloudUserProfile>[0] | null) => {
      const profile = user ? toCloudUserProfile(user) : null;
      const email = profile?.email ?? null;
      setCloudUserEmail(email);
      setCloudUserAvatarUrl(profile?.avatarUrl ?? null);
      if (!email || (__DEV__ && isDevHistoryHidden())) return;
      try {
        pendingDeletesRef.current = getPendingDeletes(email);
        await flushPendingDeletes(email);

        await migrateLocalHistory(historyStoreRef.current);
        const remoteEntries = await pullCloudHistory();

        const remoteEntriesFiltered = remoteEntries.filter(
          (entry) => !pendingDeletesRef.current.includes(entry.id)
        );

        const currentStore = historyStoreRef.current;
        const merged = { ...currentStore, entries: mergeHistory(currentStore.entries, remoteEntriesFiltered) };
        commitHistoryStore(merged);
      } catch (err) {
        console.error('No se pudo sincronizar el historial.', err);
        setError('No se pudo sincronizar el historial. Tus Núcleos locales siguen disponibles.');
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => hydrateCloudHistory(sessionData.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateCloudHistory(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Eliminado el useEffect de sincronización global masiva para favorecer sync selectivo

  const goToStep = useCallback((idx: number, fromViewAll = false) => {
    const previousStep = currentStep;
    setIsComplete(false);
    setCurrentStep(idx);
    const nextViewAll = fromViewAll ? false : viewAll;
    if (fromViewAll) setViewAll(false);
    persistSessionState(idx, false, nextViewAll);

    if (
      idx > previousStep &&
      previousStep > 0 &&
      data?.readingSections?.length &&
      isLastStepInReadingSection(previousStep, data.readingSections)
    ) {
      setSectionCompleteCue(previousStep);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => setSectionCompleteCue(null), 1200);
    } else {
      stepHaptic();
    }
  }, [currentStep, data?.readingSections, persistSessionState, viewAll]);

  const syncReadingStep = useCallback((step: number) => {
    setCurrentStep((prev) => {
      if (prev === step) return prev;
      persistSessionState(step, isComplete, viewAll);
      return step;
    });
  }, [persistSessionState, isComplete, viewAll]);

  const toggleViewMode = useCallback(() => {
    const nextViewAll = !viewAll;
    setViewAll(nextViewAll);
    setIsComplete(false);
    persistSessionState(currentStep, false, nextViewAll);
    stepHaptic();
  }, [currentStep, persistSessionState, viewAll]);

  const dismissTransformIncomplete = useCallback(() => {
    setTransformIncomplete(false);
  }, []);

  const failTransform = useCallback(
    (message: string, partialShown: boolean, sourceKind: TransformSourceKind, offline = false) => {
      console.error('Transform failed:', { message, sourceKind, offline });
      if (partialShown) {
        setTransformIncomplete(true);
        setPhase('result');
      } else {
        setError(offline ? OFFLINE_TRANSFORM_MESSAGE : GENERIC_TRANSFORM_ERROR);
        setTransformIncomplete(false);
        setPhase('input');
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    []
  );

  const handleCancelLoading = useCallback(() => {
    transformCancelledRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreamGenerating(false);
    setCollectionGenerationProgress(null);
    resetStreamGenerationUi();

    if (partialShownRef.current) {
      setTransformIncomplete(true);
      setPhase('result');
    } else {
      setData(null);
      setTransformIncomplete(false);
      setPhase('input');
    }

    partialShownRef.current = false;
  }, [resetStreamGenerationUi]);

  const handleAttachmentError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.';
    setError(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const handlePickImage = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const file = await pickImageFromLibrary();
      if (!file) return;
      setUploadedFile(file);
      setError(null);
      stepHaptic();
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const handlePickCamera = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const file = await pickImageFromCamera();
      if (!file) return;
      setUploadedFile(file);
      setError(null);
      stepHaptic();
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const handlePickFile = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const result = await pickFileAttachment();
      if (!result) return;

      if ('textContent' in result) {
        setUploadedFile(result.file);
        setInputText(result.textContent);
      } else {
        setUploadedFile(result);
        if (result.isPdf || result.isVideo) setInputText('');
      }

      setError(null);
      stepHaptic();
    } catch (err) {
      handleAttachmentError(err);
    }
  }, [handleAttachmentError]);

  const removeUploadedFile = useCallback(() => {
    setUploadedFile(null);
    if (uploadedFile?.isPdf || uploadedFile?.isVideo) setInputText('');
  }, [uploadedFile?.isPdf, uploadedFile?.isVideo]);

  const handleTransform = useCallback(async () => {
    const bodyText = pastedText?.trim() ?? inputText.trim();
    if (!bodyText && !uploadedFile) return;

    if (await isDeviceOffline()) {
      setError(OFFLINE_TRANSFORM_MESSAGE);
      setPhase('input');
      return;
    }

    let urlDetection: ReturnType<typeof detectUrlInput> | null = null;
    if (!uploadedFile && bodyText) {
      urlDetection = detectUrlInput(bodyText);
      if (urlDetection.kind === 'invalid') {
        setError(urlDetection.message);
        return;
      }
    }

    setError(null);
    setTransformIncomplete(false);
    setAttachMenuOpen(false);
    clearComposerDraft();

    const sourceKind = resolveTransformSourceKind(uploadedFile, urlDetection);
    const mapId = generateMapId();
    const sourceLabel =
      uploadedFile?.name || bodyText.split('\n')[0]?.slice(0, 80) || 'Fuente analizada';

    let body: TransformRequest;
    if (uploadedFile?.isPdf && uploadedFile.fileData) {
      body = {
        type: 'pdf',
        fileData: uploadedFile.fileData,
        mimeType: uploadedFile.mimeType || 'application/pdf',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel,
        mapId,
      };
    } else if (uploadedFile?.isVideo && uploadedFile.fileData) {
      body = {
        type: 'video',
        fileData: uploadedFile.fileData,
        mimeType: uploadedFile.mimeType || 'video/mp4',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel,
        mapId,
      };
      if (inputText.trim()) body.text = inputText.trim();
    } else if (uploadedFile?.isImage && uploadedFile.fileData) {
      body = {
        type: 'image',
        fileData: uploadedFile.fileData,
        mimeType: uploadedFile.mimeType || 'image/jpeg',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel,
        mapId,
      };
      if (inputText.trim()) body.text = inputText.trim();
    } else if (urlDetection?.kind === 'youtube') {
      body = {
        text: urlDetection.url,
        type: 'youtube',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel: urlDetection.url,
        mapId,
      };
    } else if (urlDetection?.kind === 'link') {
      body = {
        text: urlDetection.url,
        type: 'link',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel: urlDetection.url,
        mapId,
      };
    } else {
      body = {
        text: bodyText,
        type: 'text',
        preferredModel: 'auto',
        intent,
        depth: depthPreference,
        outputLanguage: 'es',
        sourceLabel,
        mapId,
      };
    }

    const accessToken = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

    let collectionPlan: SourceAnalysisResponse | null = null;
    try {
      const analysis = await analyzeTransformSource(body, headers);
      if (analysis.shouldProposeSplit && analysis.partCount >= 2) {
        const choice = await promptCollectionSplit(analysis.partCount);
        if (choice === 'split') {
          collectionPlan = analysis;
        } else {
          body = { ...body, singleNucleoMode: true };
        }
      }
    } catch {
      // Si el análisis falla, continúa con transform normal.
    }

    setPhase('loading');
    transformCancelledRef.current = false;
    partialShownRef.current = false;
    resetStreamGenerationUi();
    bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[0]);
    setStreamLoadPhase(0);
    streamProgressShared.value = STREAM_PROGRESS_MILESTONES[0];

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let hasShownPartial = false;

    try {
      if (collectionPlan) {
        const collectionId = generateMapId();
        let store = createCollection(historyStoreRef.current, {
          id: collectionId,
          title: collectionPlan.collectionTitle,
        });
        commitHistoryStore(store);

        const generatedIds: string[] = [];
        for (let index = 0; index < collectionPlan.parts.length; index += 1) {
          if (transformCancelledRef.current) return;

          const part = collectionPlan.parts[index];
          setCollectionGenerationProgress({
            completed: index,
            total: collectionPlan.parts.length,
          });
          streamProgressShared.value = Math.round(
            (index / Math.max(collectionPlan.parts.length, 1)) * 100
          );

          const partMapId = generateMapId();
          const partBody = buildCollectionPartBody(body, part, partMapId);
          const response = await fetchWithTimeout(apiUrl('/api/transform'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(headers ?? {}),
            },
            body: JSON.stringify(partBody),
            signal: controller.signal,
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error || GENERIC_TRANSFORM_ERROR);
          }

          const normalized = normalizeMapData(await response.json());
          if (!normalized) {
            throw new Error(GENERIC_TRANSFORM_ERROR);
          }
          store = createEntry(
            store,
            { data: normalized, currentStep: 0, isComplete: false, viewAll: false },
            toSourceType(partBody.type),
            partMapId,
            collectionId
          );
          store = registerNucleoInCollection(store, collectionId, partMapId);
          commitHistoryStore(store);

          const createdEntry = store.entries.find((item) => item.id === partMapId);
          if (createdEntry) {
            syncCloudEntry(createdEntry);
          }
          generatedIds.push(partMapId);
        }

        setCollectionGenerationProgress({
          completed: collectionPlan.parts.length,
          total: collectionPlan.parts.length,
        });
        streamProgressShared.value = 100;

        const firstId = generatedIds[0];
        store = setActiveId(store, firstId);
        commitHistoryStore(store);
        const firstEntry = getActiveEntry(store);
        if (!firstEntry) {
          throw new Error(GENERIC_TRANSFORM_ERROR);
        }

        const firstMap = normalizeMapData(firstEntry.session.data);
        setData(firstMap);
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setUploadedFile(null);
        setPastedText(null);
        setInputText('');
        inputTextRef.current = '';
        setPhase('result');
        setTransformIncomplete(false);
        stepHaptic();
        return;
      }

      setIsStreamGenerating(true);

      const saveCompletedMap = (normalized: ActionMapData) => {
        const session = {
          data: normalized,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        };

        const currentStore = historyStoreRef.current;
        const updatedStore = createEntry(currentStore, session, toSourceType(body.type), mapId);
        commitHistoryStore(updatedStore);

        const createdEntry = updatedStore.entries.find((item) => item.id === mapId);
        if (createdEntry) {
          syncCloudEntry(createdEntry);
        }

        setData(normalized);
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setUploadedFile(null);
        setPastedText(null);
        setInputText('');
        inputTextRef.current = '';
        // A pending intro transition owns the phase swap (bar must reach 100%
        // on screen first) — don't jump ahead of it.
        if (phaseRef.current !== 'result' && !introTransitionTimeoutRef.current) {
          setPhase('result');
        }
        setTransformIncomplete(false);
      };

      const applyPartialMap = (partialMap: ActionMapData) => {
        setData(partialMap);
        setStreamLoadPhase(resolveStreamLoadPhase(partialMap));

        if (partialMap.coreIdea?.trim()) {
          bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[2]);
        }
        if ((partialMap.steps?.length ?? 0) > 0) {
          bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[3]);
        }

        if (
          !isIntroReadyForTransition(partialMap) ||
          phaseRef.current !== 'loading' ||
          // Already scheduled — later partials must not push the swap back.
          introTransitionTimeoutRef.current
        ) {
          return;
        }

        hasShownPartial = true;
        partialShownRef.current = true;
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        bumpStreamProgressCap(100);
        streamProgressShared.value = 100;
        introTransitionTimeoutRef.current = setTimeout(() => {
          introTransitionTimeoutRef.current = null;
          if (phaseRef.current !== 'loading') return;
          setLoadingFadeOverlayActive(true);
          setPhase('result');
        }, INTRO_TRANSITION_BAR_MS);
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
            bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[1]);
          },
          onPartial: (partialMap) => {
            applyPartialMap(partialMap);
          },
          onDone: (finalMap) => {
            bumpStreamProgressCap(STREAM_PROGRESS_MILESTONES[4]);
            streamProgressShared.value = STREAM_PROGRESS_MILESTONES[4];
            // The result appears only after the bar visually reaches 100%.
            // If a partial already scheduled the swap, keep that schedule.
            if (phaseRef.current === 'loading' && !introTransitionTimeoutRef.current) {
              hasShownPartial = true;
              partialShownRef.current = true;
              setCurrentStep(0);
              setIsComplete(false);
              setViewAll(false);
              introTransitionTimeoutRef.current = setTimeout(() => {
                introTransitionTimeoutRef.current = null;
                if (phaseRef.current !== 'loading') return;
                setLoadingFadeOverlayActive(true);
                setPhase('result');
              }, INTRO_TRANSITION_BAR_MS);
            }
            saveCompletedMap(finalMap);
            stepHaptic();
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (transformCancelledRef.current) {
          return;
        }
        failTransform(TRANSFORM_IDLE_TIMEOUT_MESSAGE, hasShownPartial, sourceKind);
        return;
      }

      const rawMessage =
        err instanceof Error ? err.message : 'No se pudo procesar el contenido.';
      const offline = await isDeviceOffline();
      failTransform(rawMessage, hasShownPartial, sourceKind, offline);
    } finally {
      setIsStreamGenerating(false);
      setCollectionGenerationProgress(null);
      abortControllerRef.current = null;
    }
  }, [bumpStreamProgressCap, commitHistoryStore, depthPreference, failTransform, inputText, intent, modelPreference, pastedText, resetStreamGenerationUi, uploadedFile, syncCloudEntry]);

  const handleNewMap = useCallback(() => {
    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const updatedStore = setActiveId(currentStore, null);
    commitHistoryStore(updatedStore);
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
    continueTransitionEnteredAtRef.current = null;
    continueChipRectRef.current = null;
    continueChipLabelRef.current = '';
    continueEntryIdRef.current = null;
    setContinueTransition(null);
    setContinueTransitionHandoff(false);
    setPhase('input');
  }, [commitHistoryStore, flushPendingSessionPersist]);

  const handleOpenDemoNucleo = useCallback(() => {
    flushPendingSessionPersist();
    const currentStore = historyStoreRef.current;
    const existing = currentStore.entries.find((entry) => entry.id === DEMO_NUCLEO_ID);

    if (existing) {
      const normalized = normalizeMapData(existing.session.data);
      if (!normalized) return;
      const updatedStore = setActiveId(currentStore, DEMO_NUCLEO_ID);
      commitHistoryStore(updatedStore);
      setData(normalized);
      setIntentState(normalized.intent ?? 'understand');
      setCurrentStep(existing.session.currentStep);
      setIsComplete(existing.session.isComplete ?? false);
      setViewAll(existing.session.viewAll ?? false);
      setHistoryOpen(false);
      setChatOpen(false);
      setEssentialsReview(false);
      setPhase('result');
      setError(null);
      setTransformIncomplete(false);
      stepHaptic();
      return;
    }

    const demoSession = {
      data: DEMO_NUCLEO_DATA,
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    };
    const updatedStore = createEntry(currentStore, demoSession, 'text', DEMO_NUCLEO_ID);
    commitHistoryStore(updatedStore);
    setData(DEMO_NUCLEO_DATA);
    setIntentState('understand');
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    setHistoryOpen(false);
    setChatOpen(false);
    setEssentialsReview(false);
    setPhase('result');
    setError(null);
    setTransformIncomplete(false);
    stepHaptic();
  }, [commitHistoryStore, flushPendingSessionPersist]);

  const handleSignOut = useCallback(async () => {
    flushPendingSessionPersist();
    // 1. Cerrar drawers y overlays
    setHistoryOpen(false);
    setChatOpen(false);
    setAuthOpen(false);

    // 2. Limpiar estados del mapa y UI
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

    // 3. Limpiar variables de la nube
    setCloudUserEmail(null);
    setCloudUserAvatarUrl(null);

    // 4. Purgar historial local de mapas en disco y memoria de forma segura
    const emptyStore: HistoryStore = { entries: [], activeId: null, collections: [] };
    commitHistoryStore(emptyStore);

    // 5. Ejecutar signOut remoto
    try {
      await signOut();
    } catch (err) {
      console.error('Error al cerrar sesión remota:', err);
      throw err;
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

  const handleSelectHistory = useCallback(
    (id: string) => {
      flushPendingSessionPersist();
      const currentStore = historyStoreRef.current;
      const entry = currentStore.entries.find((e) => e.id === id);
      if (!entry) return;

      const normalized = normalizeMapData(entry.session.data);
      if (!normalized) return;

      const updatedStore = setActiveId(currentStore, id);
      commitHistoryStore(updatedStore);

      setData(normalized);
      intentUserOverrideRef.current = false;
      setIntentState(normalized.intent ?? 'understand');
      setCurrentStep(entry.session.currentStep);
      setIsComplete(entry.session.isComplete ?? false);
      setViewAll(entry.session.viewAll ?? false);
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
      stepHaptic();
    },
    [commitHistoryStore, flushPendingSessionPersist]
  );

  const beginContinueTransition = useCallback(
    (id: string, chipRect: ContinueChipRect, chipLabel: string) => {
      flushPendingSessionPersist();
      const currentStore = historyStoreRef.current;
      const entry = currentStore.entries.find((e) => e.id === id);
      if (!entry) return;

      const normalized = normalizeMapData(entry.session.data);
      if (!normalized) return;

      const updatedStore = setActiveId(currentStore, id);
      commitHistoryStore(updatedStore);

      setData(normalized);
      intentUserOverrideRef.current = false;
      setIntentState(normalized.intent ?? 'understand');
      setCurrentStep(entry.session.currentStep);
      setIsComplete(entry.session.isComplete ?? false);
      setViewAll(entry.session.viewAll ?? false);
      setHistoryOpen(false);
      setChatOpen(false);
      setEssentialsReview(false);
      setError(null);
      setTransformIncomplete(false);
      setContinueTransitionHandoff(false);
      continueChipRectRef.current = chipRect;
      continueChipLabelRef.current = chipLabel;
      continueEntryIdRef.current = id;
      setContinueTransition({
        mode: 'expand',
        chipRect,
        chipLabel,
        entryId: id,
      });
    },
    [commitHistoryStore, flushPendingSessionPersist]
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
    setPhase('input');
  }, []);

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

      if (cloudSignedIn && cloudUserEmail) {
        const nextDeletes = Array.from(new Set([...pendingDeletesRef.current, id]));
        pendingDeletesRef.current = nextDeletes;
        savePendingDeletes(cloudUserEmail, nextDeletes);

        deleteCloudHistoryEntry(id)
          .then(() => {
            const updatedDeletes = pendingDeletesRef.current.filter((item) => item !== id);
            pendingDeletesRef.current = updatedDeletes;
            savePendingDeletes(cloudUserEmail, updatedDeletes);
          })
          .catch((err) => {
            console.error(`Error al eliminar en la nube el mapa ${id}. Se reintentará en segundo plano.`, err);
          });
      }

      if (wasActive) {
        setData(null);
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setError(null);
        setPhase('input');
      }

      stepHaptic();
    },
    [commitHistoryStore, cloudSignedIn, cloudUserEmail, savePendingDeletes]
  );

  const handleRenameHistory = useCallback((id: string, title: string) => {
    const currentStore = historyStoreRef.current;
    const updatedStore = renameEntry(currentStore, id, title);
    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((item) => item.id === id);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }

    stepHaptic();
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
      stepHaptic();
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

  const handlePinHistory = useCallback((id: string) => {
    const currentStore = historyStoreRef.current;
    const updatedStore = togglePinEntry(currentStore, id);
    commitHistoryStore(updatedStore);

    const updatedEntry = updatedStore.entries.find((item) => item.id === id);
    if (updatedEntry) {
      syncCloudEntry(updatedEntry);
    }

    stepHaptic();
  }, [syncCloudEntry, commitHistoryStore]);

  const handleCompleteMap = useCallback(() => {
    setIsComplete(true);
    setEssentialsReview(false);
    persistSessionState(currentStep, true, viewAll);
  }, [currentStep, persistSessionState, viewAll]);

  const triggerCompletionCeremonyIfNeeded = useCallback((): boolean => {
    const activeId = historyStoreRef.current.activeId;
    if (!activeId) return false;

    const entry = historyStoreRef.current.entries.find((item) => item.id === activeId);
    if (!entry || entry.completionCeremonyShown) return false;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

      const prepareResponse = await fetchWithTimeout(
        apiUrl(`/api/maps/${mapId}/cheatsheet.prepare`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

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

      stepHaptic();
    } catch (err) {
      console.error('Error al generar o compartir el PDF:', err);
      setError(err instanceof Error ? err.message : 'No se pudo generar la ficha PDF.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      error,
      setError,
      data,
      historyStore,
      currentStep,
      isComplete,
      viewAll,
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
      paywallOpen,
      setPaywallOpen,
      openPaywall,
      cloudUserEmail,
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
      totalSteps,
      canSubmit,
      hideTextInput,
      composerPlaceholder,
      hasAnyNucleo,
      continueEntry: visibleContinueEntry,
      dismissContinueChip,
      progressLabel,
      sectionCompleteCue,
      stepProgress,
      goToStep,
      syncReadingStep,
      toggleViewMode,
      handleCancelLoading,
      handlePickImage,
      handlePickCamera,
      handlePickFile,
      removeUploadedFile,
      handleTransform,
      handleOpenDemoNucleo,
      ...(__DEV__ ? { devHistoryHidden, devHideHistory, devRestoreHistory } : {}),
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
      collectionGenerationProgress,
      streamLoadPhase,
      streamProgressShared,
      loadingFadeOverlayActive,
      completeLoadingFadeOverlay,
      isPdfGenerating,
      transformIncomplete,
      dismissTransformIncomplete,
      persistComposerDraft,
      handleSignOut,
    }),
    [
      phase,
      inputText,
      pastedText,
      handleComposerTextChange,
      removePastedText,
      intent,
      setIntent,
      error,
      data,
      historyStore,
      currentStep,
      isComplete,
      viewAll,
      historyOpen,
      setHistoryOpen,
      openHistoryDrawer,
      closeHistoryDrawer,
      toggleHistoryDrawer,
      chatOpen,
      authOpen,
      openAuthSheet,
      paywallOpen,
      openPaywall,
      cloudUserEmail,
      cloudUserAvatarUrl,
      cloudSignedIn,
      isPro,
      uploadedFile,
      attachMenuOpen,
      modelPreference,
      depthPreference,
      setDepthPreference,
      totalSteps,
      canSubmit,
      hideTextInput,
      composerPlaceholder,
      hasAnyNucleo,
      visibleContinueEntry,
      dismissContinueChip,
      progressLabel,
      sectionCompleteCue,
      stepProgress,
      goToStep,
      syncReadingStep,
      toggleViewMode,
      handleCancelLoading,
      handlePickImage,
      handlePickCamera,
      handlePickFile,
      removeUploadedFile,
      handleTransform,
      handleOpenDemoNucleo,
      devHistoryHidden,
      devHideHistory,
      devRestoreHistory,
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
      collectionGenerationProgress,
      streamLoadPhase,
      streamProgressShared,
      loadingFadeOverlayActive,
      completeLoadingFadeOverlay,
      isPdfGenerating,
      transformIncomplete,
      dismissTransformIncomplete,
      persistComposerDraft,
      handleSignOut,
    ]
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) throw new Error('useAppSession must be used within AppSessionProvider');
  return context;
}
