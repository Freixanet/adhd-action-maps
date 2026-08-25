/**
 * LEGACY / REFERENCE ONLY — not the product UI.
 * Canonical client: `mobile/`. See `src/LEGACY.md`.
 */
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowUp,
  Check,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  X,
  File,
  Moon,
  Sun,
  Clock,
  Layers,
  List,
  History,
  Settings,
  LogOut,
  SquarePen,
  Plus,
  Camera,
  Paperclip,
} from 'lucide-react';
import { apiUrl } from './apiBase';
import type { ActionMapData } from './contracts';
import HistoryPanel from './components/HistoryPanel';
import AppIcon from './components/AppIcon';
import NucleoIcon from './components/NucleoIcon';
import ProfileAvatar from './components/ProfileAvatar';
import { toCloudUserProfile, type CloudUserProfile } from './cloudUserProfile';
import LoadingState from './components/LoadingState';
import MenuTwoLines from './components/MenuTwoLines';
import ReadingProgressBar from './components/ReadingProgressBar';
import BalancedText from './components/BalancedText';
import { useKeyboardDismissOnSwipeDown } from './hooks/useDismissKeyboardOnPullDown';
import { useNativeComposer, type NativeComposerMetrics } from './hooks/useNativeComposer';
import {
  getInitialModelPreference,
  MODEL_OPTIONS,
  saveModelPreference,
  type ModelPreference,
} from './modelPreference';
import {
  APP_VARIANT_OPTIONS,
  getAppVariant,
  switchAppVariant,
} from './appVariant';
import {
  createEntry,
  deleteEntry,
  getActiveEntry,
  loadHistory,
  renameEntry,
  saveHistory,
  setActiveId,
  togglePinEntry,
  updateActiveSession,
  type HistoryStore,
  type SourceType,
  type HistoryEntry,
} from './history';
import { detectUrlInput, friendlyTransformError, type UrlInputDetection } from './urlInput';
import {
  fetchTransformWithProgress,
  TRANSFORM_IDLE_TIMEOUT_MESSAGE,
} from '@shared/transformStream';
import {
  deleteCloudHistoryEntry,
  migrateLocalHistory,
  pullCloudHistory,
  pushHistoryEntry,
  signInWith,
  signInWithPassword,
  signUpWithPassword,
  signOut,
} from './cloudHistory';
import { isCloudSyncConfigured, supabase } from './supabase';

type UploadedFile = {
  name: string;
  size: number;
  isPdf?: boolean;
  isImage?: boolean;
  fileData?: string;
  mimeType?: string;
  previewUrl?: string;
};

const DESKTOP_BREAKPOINT = 1024;
const RECENT_IMAGES_KEY = 'nucleo-recent-images';
const MAX_RECENT_IMAGES = 8;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_SIZE_MESSAGE =
  'El archivo supera el límite de 15 MB. Prueba con un archivo más pequeño.';
const LOCAL_FILE_READ_ERROR_MESSAGE =
  'No se pudo leer el archivo en el dispositivo. Prueba con otro archivo.';
const IMAGE_MAX_DIMENSION = 1024;

function loadRecentImages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_IMAGES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Downscales images to a max dimension and re-encodes as JPEG. This keeps both
// the network payload to Gemini and the localStorage "recents" cache small.
async function processImageFile(
  file: File
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const originalDataUrl = await readFileAsDataUrl(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      image.src = originalDataUrl;
    });

    let { width, height } = img;
    if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
      const scale = IMAGE_MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible.');

    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return { dataUrl, base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' };
  } catch {
    return {
      dataUrl: originalDataUrl,
      base64: originalDataUrl.split(',')[1] ?? '',
      mimeType: file.type || 'image/jpeg',
    };
  }
}
const PAGE_BOTTOM_PAD_PX = 24;

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function resolveSourceType(text: string, uploadedFile: UploadedFile | null): SourceType {
  if (uploadedFile?.isPdf) return 'pdf';
  if (uploadedFile) return 'file';
  const trimmed = text.trim();
  const detected = detectUrlInput(text);
  if (detected.kind === 'youtube') return 'youtube';
  if (detected.kind === 'link') return 'link';
  if (/\[\d{1,2}:\d{2}/.test(trimmed)) return 'youtube';
  return 'text';
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function parseTotalMinutes(steps: any[]): number | null {
  if (!steps?.length) return null;
  let total = 0;
  let found = false;
  for (const step of steps) {
    const match = String(step.time || '').match(/(\d+)\s*min/i);
    if (match) {
      total += parseInt(match[1], 10);
      found = true;
    }
  }
  return found ? total : null;
}

function mergeHistory(localEntries: HistoryEntry[], cloudEntries: HistoryEntry[]): HistoryEntry[] {
  const entries = new Map<string, HistoryEntry>();
  for (const entry of [...localEntries, ...cloudEntries]) {
    const existing = entries.get(entry.id);
    if (!existing || entry.updatedAt > existing.updatedAt) entries.set(entry.id, entry);
  }
  return [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
}

function readAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.search.slice(1);
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  if (!params.get('error') && !params.get('error_code')) return null;

  if (params.get('error_code') === 'otp_expired') {
    return 'El acceso caducó. Vuelve a entrar con Google o email y contraseña desde el menú de cuenta (icono M).';
  }

  const description = params.get('error_description');
  if (description) return decodeURIComponent(description.replace(/\+/g, ' '));
  return 'No se pudo iniciar sesión. Inténtalo de nuevo desde el menú de cuenta.';
}

function clearAuthCallbackFromUrl() {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
}

function authErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'No se pudo completar el acceso.';
  const msg = err.message.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('user already registered')) return 'Esa cuenta ya existe. Prueba a entrar.';
  if (msg.includes('password') && msg.includes('least')) return 'La contraseña debe tener al menos 6 caracteres.';
  return err.message;
}

export default function ClassicApp() {
  useKeyboardDismissOnSwipeDown();
  const initialHistory: HistoryStore =
    typeof window !== 'undefined' ? loadHistory() : { activeId: null, entries: [], collections: [] };
  const initialActive = getActiveEntry(initialHistory);

  const [historyStore, setHistoryStore] = useState<HistoryStore>(initialHistory);
  const [inputText, setInputText] = useState('');
  const [appState, setAppState] = useState<'input' | 'loading' | 'result'>(
    initialActive ? 'result' : 'input'
  );
  const [data, setData] = useState<any>(initialActive?.session.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(initialActive?.session.currentStep ?? 0);
  const [isComplete, setIsComplete] = useState(initialActive?.session.isComplete ?? false);
  const [viewAll, setViewAll] = useState(initialActive?.session.viewAll ?? false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  const [isMapOpen, setIsMapOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [modelPreference, setModelPreference] = useState<ModelPreference>(getInitialModelPreference);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUserProfile | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authIsSignUp, setAuthIsSignUp] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recentImages, setRecentImages] = useState<string[]>(loadRecentImages);
  const [isIndexExpanded, setIsIndexExpanded] = useState(true);
  const [isStreamGenerating, setIsStreamGenerating] = useState(false);
  const [showStepFooter, setShowStepFooter] = useState(false);
  const reduceMotion = useReducedMotion();

  const contentRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const stepFooterRef = useRef<HTMLDivElement>(null);
  const [contentBottomPad, setContentBottomPad] = useState(PAGE_BOTTOM_PAD_PX);
  const [nativeComposerReservedHeight, setNativeComposerReservedHeight] = useState(184);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transformCancelledByUserRef = useRef(false);
  const handleTransformRef = useRef<(textOverride?: string) => Promise<void>>(async () => {});
  const inputTextRef = useRef(inputText);
  const uploadedFileRef = useRef(uploadedFile);
  inputTextRef.current = inputText;
  uploadedFileRef.current = uploadedFile;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const scrollSpyLockRef = useRef(false);
  const sidebarTouchStartRef = useRef<{ x: number; y: number; dragging: boolean; opening: boolean } | null>(null);
  const sidebarDragXRef = useRef<number | null>(null);
  const suppressMainClickRef = useRef(false);
  const historyStoreRef = useRef(historyStore);

  const SWIPE_THRESHOLD = 60;

  const getMobileSidebarWidthPx = useCallback(
    () => Math.min(window.innerWidth * 0.82, 360),
    []
  );

  const lockMainScroll = useCallback(() => {
    const main = mainRef.current;
    if (main) {
      main.style.overflow = 'hidden';
      main.style.touchAction = 'none';
    }
    const el = contentRef.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    el.style.touchAction = 'none';
  }, []);

  const unlockMainScroll = useCallback(() => {
    const main = mainRef.current;
    if (main) {
      main.style.overflow = '';
      main.style.touchAction = '';
    }
    const el = contentRef.current;
    if (!el) return;
    el.style.overflow = '';
    el.style.touchAction = '';
  }, []);

  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [sidebarDragX, setSidebarDragX] = useState<number | null>(null);
  const [isSidebarSettling, setIsSidebarSettling] = useState(false);
  const sheetTransitionCompleteRef = useRef<(() => void) | null>(null);

  const handleNativeComposerMetrics = useCallback((metrics: NativeComposerMetrics) => {
    setNativeComposerReservedHeight(metrics.visible ? Math.max(120, metrics.height + 24) : PAGE_BOTTOM_PAD_PX);
  }, []);

  const triggerNativeSend = useCallback((text?: string) => {
    if (text) {
      inputTextRef.current = text;
      setInputText(text);
    }
    queueMicrotask(() => {
      void handleTransformRef.current(text);
    });
  }, []);

  const { isNativeIOS, clearText, setLayout: setNativeComposerLayout } = useNativeComposer({
    appState,
    onChange: (text) => {
      inputTextRef.current = text;
      setInputText(text);
    },
    onSend: triggerNativeSend,
    onAttach: () => fileInputRef.current?.click(),
    onMenu: () => setProfileMenuOpen(true),
    onMetricsChange: handleNativeComposerMetrics,
    mainRef,
    attachment: uploadedFile
      ? {
          name: uploadedFile.name,
          previewUrl: uploadedFile.previewUrl,
          isImage: uploadedFile.isImage,
        }
      : null,
    visible:
      appState === 'input' &&
      !profileMenuOpen,
  });

  const syncNativeComposerSheetLayout = useCallback(
    (
      offsetX: number,
      options: { animated?: boolean; durationMs?: number; curve?: 'easeOut' | 'easeInOut' | 'linear' } = {}
    ) => {
      if (!isNativeIOS) return;
      const mainWidth = mainRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      setNativeComposerLayout({
        mainOffsetX: offsetX,
        mainWidth,
        sidebarOpen: offsetX > 0.5,
        animated: options.animated ?? false,
        durationMs: options.durationMs,
        curve: options.curve,
      });
    },
    [isNativeIOS, setNativeComposerLayout]
  );

  const totalSteps = data?.steps?.length ?? 0;
  const totalMinutes = useMemo(() => parseTotalMinutes(data?.steps ?? []), [data]);

  const progress = useMemo(() => {
    if (isComplete) return 100;
    if (viewAll) return 0;
    if (!data || totalSteps === 0) return 0;
    const segments = totalSteps + 1;
    return (currentStep / (segments - 1)) * 100;
  }, [isComplete, viewAll, data, totalSteps, currentStep]);

  const progressLabel = useMemo(() => {
    if (!data || totalSteps === 0) return '';
    if (currentStep === 0) return `Introducción · 0 de ${totalSteps} pasos`;
    if (isComplete) return `Completado · ${totalSteps} de ${totalSteps} pasos`;
    return `Paso ${currentStep} de ${totalSteps}`;
  }, [currentStep, data, totalSteps, isComplete]);

  const shouldShowStepFooter =
    showStepFooter || (!isDesktop && currentStep === 0 && !viewAll && !isComplete);

  React.useEffect(() => {
    historyStoreRef.current = historyStore;
  }, [historyStore]);

  React.useEffect(() => {
    const authError = readAuthCallbackError();
    if (authError) {
      setSyncError(authError);
      clearAuthCallbackFromUrl();
    }
  }, []);

  React.useEffect(() => {
    if (!supabase) return;

    const hydrateCloudHistory = async (user: Parameters<typeof toCloudUserProfile>[0] | null) => {
      setCloudUser(user ? toCloudUserProfile(user) : null);
      if (!user) return;
      try {
        await migrateLocalHistory(historyStoreRef.current);
        const remoteEntries = await pullCloudHistory();
        setHistoryStore((previous) => {
          const merged = { ...previous, entries: mergeHistory(previous.entries, remoteEntries) };
          saveHistory(merged);
          return merged;
        });
        setSyncError(null);
      } catch (err) {
        console.error(err);
        setSyncError('No se pudo sincronizar el historial. Se conservará en este dispositivo.');
      }
    };

    void supabase.auth.getSession().then(({ data }) => hydrateCloudHistory(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateCloudHistory(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!cloudUser) return;
    const timer = window.setTimeout(() => {
      void Promise.all(historyStore.entries.map(pushHistoryEntry)).catch((err) => {
        console.error(err);
        setSyncError('Los cambios se guardaron localmente; la sincronización se reintentará.');
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [historyStore, cloudUser]);

  const scrollPageToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    contentRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  React.useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  React.useEffect(() => {
    if (!attachMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [attachMenuOpen]);

  React.useEffect(() => {
    if (appState !== 'result') return;

    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [appState, historyStore.activeId, viewAll, isComplete]);

  React.useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktop(desktop);
      setIsMapOpen(desktop);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerMobileSidebarHaptic = useCallback(() => {
    if (isDesktop) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
  }, [isDesktop]);

  const animateMainSheetTo = useCallback(
    (targetX: number, onComplete?: () => void) => {
      if (isDesktop) {
        onComplete?.();
        return;
      }

      const width = getMobileSidebarWidthPx();
      const currentX = sidebarDragXRef.current ?? (isMapOpen ? width : 0);

      if (Math.abs(currentX - targetX) < 1) {
        setIsSidebarDragging(false);
        setIsSidebarSettling(false);
        setSidebarDragX(null);
        sidebarDragXRef.current = null;
        syncNativeComposerSheetLayout(targetX, { animated: false });
        onComplete?.();
        return;
      }

      setIsSidebarDragging(false);
      setIsSidebarSettling(true);
      sheetTransitionCompleteRef.current = onComplete ?? null;
      setSidebarDragX(currentX);
      sidebarDragXRef.current = currentX;
      syncNativeComposerSheetLayout(currentX, { animated: false });

      requestAnimationFrame(() => {
        setSidebarDragX(targetX);
        sidebarDragXRef.current = targetX;
        syncNativeComposerSheetLayout(targetX, {
          animated: true,
          durationMs: 300,
          curve: 'easeOut',
        });
      });
    },
    [getMobileSidebarWidthPx, isDesktop, isMapOpen, syncNativeComposerSheetLayout]
  );

  const closeMobileSidebar = useCallback(() => {
    if (isDesktop) {
      setIsSidebarDragging(false);
      setIsSidebarSettling(false);
      setIsMapOpen(false);
      setSidebarDragX(null);
      sidebarDragXRef.current = null;
      return;
    }

    if (isSidebarSettling || !isMapOpen) return;

    triggerMobileSidebarHaptic();
    animateMainSheetTo(0, () => {
      setIsMapOpen(false);
    });
  }, [
    animateMainSheetTo,
    isDesktop,
    isMapOpen,
    isSidebarSettling,
    triggerMobileSidebarHaptic,
  ]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) {
      setIsMapOpen((open) => !open);
      return;
    }
    if (isSidebarSettling) return;
    if (isMapOpen) {
      closeMobileSidebar();
    } else {
      const width = getMobileSidebarWidthPx();
      setSidebarDragX(0);
      sidebarDragXRef.current = 0;
      animateMainSheetTo(width, () => {
        setIsMapOpen(true);
      });
    }
  }, [
    animateMainSheetTo,
    closeMobileSidebar,
    getMobileSidebarWidthPx,
    isDesktop,
    isMapOpen,
    isSidebarSettling,
  ]);

  const handleMainClickCapture = useCallback(
    (event: React.MouseEvent) => {
      if (suppressMainClickRef.current) {
        suppressMainClickRef.current = false;
        return;
      }
      if (!isMapOpen || isDesktop || isSidebarDragging || isSidebarSettling) return;
      event.preventDefault();
      event.stopPropagation();
      closeMobileSidebar();
    },
    [closeMobileSidebar, isDesktop, isMapOpen, isSidebarDragging, isSidebarSettling]
  );

  const handleMainTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop) return;
      const touch = e.touches[0];
      sidebarTouchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        dragging: false,
        opening: !isMapOpen,
      };
      sidebarDragXRef.current = null;
      if (isMapOpen) {
        e.stopPropagation();
      }
    },
    [isDesktop, isMapOpen]
  );

  const handleMainTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop || !sidebarTouchStartRef.current) return;

      const touch = e.touches[0];
      const start = sidebarTouchStartRef.current;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (!start.dragging) {
        if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) return;
        if (Math.abs(deltaY) > Math.abs(deltaX) * 0.75 && Math.abs(deltaY) > 8) {
          sidebarTouchStartRef.current = null;
          return;
        }
        if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
        if (start.opening) {
          if (deltaX <= 0) return;
        } else if (deltaX >= 0) {
          return;
        }
        start.dragging = true;
        setIsSidebarDragging(true);
        lockMainScroll();
      }

      e.stopPropagation();
      e.preventDefault();

      const width = getMobileSidebarWidthPx();
      const dragX = start.opening
        ? Math.max(0, Math.min(width, deltaX))
        : Math.max(0, Math.min(width, width + deltaX));
      sidebarDragXRef.current = dragX;
      setSidebarDragX(dragX);
      syncNativeComposerSheetLayout(dragX, { animated: false });
    },
    [getMobileSidebarWidthPx, isDesktop, lockMainScroll, syncNativeComposerSheetLayout]
  );

  const handleMainTouchEnd = useCallback(() => {
    if (isDesktop) return;
    const start = sidebarTouchStartRef.current;
    unlockMainScroll();
    if (!start) return;

    if (start.dragging) {
      const width = getMobileSidebarWidthPx();
      const dragX = sidebarDragXRef.current ?? (start.opening ? 0 : width);

      setIsSidebarDragging(false);
      sidebarTouchStartRef.current = null;
      suppressMainClickRef.current = true;

      if (start.opening) {
        if (dragX >= SWIPE_THRESHOLD) {
          animateMainSheetTo(width, () => {
            setIsMapOpen(true);
          });
        } else {
          animateMainSheetTo(0, () => {});
        }
      } else if (width - dragX >= SWIPE_THRESHOLD) {
        triggerMobileSidebarHaptic();
        animateMainSheetTo(0, () => {
          setIsMapOpen(false);
        });
      } else {
        animateMainSheetTo(width, () => {});
      }
      return;
    }

    sidebarTouchStartRef.current = null;
  }, [
    animateMainSheetTo,
    getMobileSidebarWidthPx,
    isDesktop,
    triggerMobileSidebarHaptic,
    unlockMainScroll,
  ]);

  const isSidebarUnderlayVisible =
    !isDesktop &&
    (isMapOpen ||
      isSidebarDragging ||
      isSidebarSettling ||
      (sidebarDragX !== null && sidebarDragX > 0));

  const showSidebarExpanded = isDesktop ? isMapOpen : isSidebarUnderlayVisible;

  const mainSheetStyle = useMemo((): React.CSSProperties | undefined => {
    if (isDesktop) return undefined;

    const style: React.CSSProperties = { willChange: 'transform' };

    if (sidebarDragX !== null) {
      style.transform = `translate3d(${sidebarDragX}px, 0, 0)`;
    } else if (isMapOpen) {
      style.transform = 'translate3d(var(--mobile-sidebar-width), 0, 0)';
    } else {
      style.transform = 'translate3d(0, 0, 0)';
    }

    if (isSidebarUnderlayVisible) {
      style.borderRadius = '48px';
      style.boxShadow =
        theme === 'dark'
          ? '0 16px 48px rgba(0,0,0,0.55)'
          : '0 16px 48px rgba(0,0,0,0.2)';
    }

    if (isSidebarDragging) {
      style.touchAction = 'none';
      style.transition = 'none';
    } else if (isSidebarSettling) {
      style.transition = 'transform 300ms ease-out';
    }

    return style;
  }, [
    isDesktop,
    isMapOpen,
    isSidebarDragging,
    isSidebarSettling,
    isSidebarUnderlayVisible,
    sidebarDragX,
    theme,
  ]);

  React.useEffect(() => {
    const node = mainRef.current;
    if (!node || isDesktop) return;

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName !== 'transform' || !isSidebarSettling) return;

      const onComplete = sheetTransitionCompleteRef.current;
      const finalX = sidebarDragXRef.current ?? 0;
      sheetTransitionCompleteRef.current = null;
      setIsSidebarSettling(false);
      setSidebarDragX(null);
      sidebarDragXRef.current = null;
      syncNativeComposerSheetLayout(finalX, { animated: false });
      onComplete?.();
    };

    node.addEventListener('transitionend', handleTransitionEnd);
    return () => node.removeEventListener('transitionend', handleTransitionEnd);
  }, [isDesktop, isSidebarSettling, syncNativeComposerSheetLayout]);

  React.useEffect(() => {
    const node = mainRef.current;
    if (!node || isDesktop) return;

    const preventScrollWhileDragging = (event: TouchEvent) => {
      if (sidebarTouchStartRef.current?.dragging || isSidebarDragging) {
        event.preventDefault();
      }
    };

    node.addEventListener('touchmove', preventScrollWhileDragging, { passive: false });
    return () => node.removeEventListener('touchmove', preventScrollWhileDragging);
  }, [isDesktop, isSidebarDragging]);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeColor = theme === 'dark' ? '#1A1A1A' : '#FAFAFA';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    document
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  }, [theme]);

  React.useEffect(() => {
    if (appState !== 'result' || !data || !historyStore.activeId) return;

    setHistoryStore((prev) => {
      const updated = updateActiveSession(prev, {
        data,
        currentStep,
        isComplete,
        viewAll,
      });
      if (!saveHistory(updated)) {
        setStorageError('No se pudo guardar el historial. Espacio de almacenamiento lleno.');
      }
      return updated;
    });
  }, [appState, data, currentStep, isComplete, viewAll, historyStore.activeId]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(MAX_UPLOAD_SIZE_MESSAGE);
      return;
    }

    setError(null);
    const handleLocalReadError = () => {
      setError(LOCAL_FILE_READ_ERROR_MESSAGE);
    };

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        setInputText(file.name);
        setUploadedFile({
          name: file.name,
          size: file.size,
          isPdf: true,
          fileData: base64,
          mimeType: 'application/pdf',
        });
      };
      reader.onerror = handleLocalReadError;
      reader.onabort = handleLocalReadError;
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setInputText(event.target?.result as string);
        setUploadedFile({ name: file.name, size: file.size });
      };
      reader.onerror = handleLocalReadError;
      reader.onabort = handleLocalReadError;
      reader.readAsText(file);
    }
  };

  const persistRecentImages = (images: string[]) => {
    const capped = images.slice(0, MAX_RECENT_IMAGES);
    setRecentImages(capped);
    let toSave = capped;
    while (toSave.length > 0) {
      try {
        localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(toSave));
        return;
      } catch {
        toSave = toSave.slice(0, -1);
      }
    }
    try {
      localStorage.removeItem(RECENT_IMAGES_KEY);
    } catch {
      // ignore
    }
  };

  const addRecentImage = (dataUrl: string) => {
    persistRecentImages([dataUrl, ...recentImages.filter((url) => url !== dataUrl)]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setAttachMenuOpen(false);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado no es una imagen.');
      return;
    }

    try {
      const { dataUrl, base64, mimeType } = await processImageFile(file);
      setUploadedFile({
        name: file.name || 'Imagen',
        size: file.size,
        isImage: true,
        fileData: base64,
        mimeType,
        previewUrl: dataUrl,
      });
      addRecentImage(dataUrl);
    } catch {
      setError('No se pudo procesar la imagen.');
    }
  };

  const attachRecentImage = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] ?? '';
    const mimeMatch = /^data:([^;]+);/.exec(dataUrl);
    setUploadedFile({
      name: 'Imagen',
      size: Math.round(base64.length * 0.75),
      isImage: true,
      fileData: base64,
      mimeType: mimeMatch?.[1] || 'image/jpeg',
      previewUrl: dataUrl,
    });
    addRecentImage(dataUrl);
    setAttachMenuOpen(false);
  };

  const removeFile = () => {
    setUploadedFile(null);
    setInputText('');
  };

  const adjustComposerHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    if (!el.value.trim()) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  React.useEffect(() => {
    if (appState === 'input') {
      adjustComposerHeight(textareaRef.current);
    }
  }, [inputText, uploadedFile, appState]);

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 3) => {
    const delays = [2000, 5000];
    for (let i = 0; i < retries; i++) {
      throwIfAborted(options.signal);
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          let serverErrorMsg = '';
          try {
            const errData = await response.json();
            if (errData?.error) serverErrorMsg = errData.error;
          } catch {
            // ignore
          }

          const customError = new Error(
            serverErrorMsg || `HTTP error! status: ${response.status}`
          );
          (customError as any).status = response.status;
          throw customError;
        }
        return response;
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        // Only retry transient failures: network errors (no status) or 503
        // (model overloaded). Retrying 429/4xx/5xx parse errors only burns the
        // daily free-tier quota without changing the outcome.
        const isRetryable = error.status === undefined || error.status === 503;
        if (i === retries - 1 || !isRetryable) throw error;
        throwIfAborted(options.signal);
        await new Promise((res) => setTimeout(res, delays[i] ?? 5000));
      }
    }
  };

  const cleanTranscript = (text: string) =>
    text
      .replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const handleCancel = () => {
    transformCancelledByUserRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAppState('input');
  };

  const handleTransform = async (textOverride?: string) => {
    const activeText = textOverride ?? inputTextRef.current;
    const trimmedText = activeText.trim();
    const currentFile = uploadedFileRef.current;
    if (!trimmedText && !currentFile) return;

    let urlDetection: UrlInputDetection | null = null;
    if (!currentFile && trimmedText) {
      urlDetection = detectUrlInput(activeText);
      if (urlDetection.kind === 'invalid') {
        setError(urlDetection.message);
        return;
      }
    }

    setAppState('loading');
    setError(null);

    transformCancelledByUserRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let body: Record<string, string>;
      if (currentFile?.isPdf && currentFile.fileData) {
        body = {
          type: 'pdf',
          fileData: currentFile.fileData,
          mimeType: currentFile.mimeType || 'application/pdf',
          preferredModel: modelPreference,
        };
      } else if (currentFile?.isImage && currentFile.fileData) {
        body = {
          type: 'image',
          fileData: currentFile.fileData,
          mimeType: currentFile.mimeType || 'image/jpeg',
          preferredModel: modelPreference,
        };
        if (trimmedText) body.text = trimmedText;
      } else if (currentFile && trimmedText) {
        body = {
          text: activeText,
          type: 'text',
          preferredModel: modelPreference,
        };
      } else {
        if (urlDetection?.kind === 'youtube') {
          body = {
            text: urlDetection.url,
            type: 'youtube',
            preferredModel: modelPreference,
          };
        } else if (urlDetection?.kind === 'link') {
          body = {
            text: urlDetection.url,
            type: 'link',
            preferredModel: modelPreference,
          };
        } else {
          body = {
            text: cleanTranscript(activeText),
            type: 'text',
            preferredModel: modelPreference,
          };
        }
      }

      const accessToken = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

      let hasShownPartial = false;
      setIsStreamGenerating(true);

      const saveCompletedMap = (parsedData: ActionMapData) => {
        const session = {
          data: parsedData,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        };
        const sourceType = resolveSourceType(activeText, currentFile);

        setHistoryStore((prev) => {
          const updated = createEntry(prev, session, sourceType);
          if (!saveHistory(updated)) {
            setStorageError('No se pudo guardar el historial. Espacio de almacenamiento lleno.');
          }
          return updated;
        });

        setData(parsedData);
        setAppState('result');
        setCurrentStep(0);
        setIsComplete(false);
        setViewAll(false);
        setIsIndexExpanded(true);
        setIsMapOpen(isDesktop);
      };

      await fetchTransformWithProgress({
        streamUrl: apiUrl('/api/transform/stream'),
        fallbackUrl: apiUrl('/api/transform'),
        body,
        headers,
        signal: controller.signal,
        handlers: {
          onPartial: (partialMap) => {
            if (!hasShownPartial) {
              hasShownPartial = true;
              setAppState('result');
              setCurrentStep(0);
              setIsComplete(false);
              setViewAll(false);
              setIsIndexExpanded(true);
              setIsMapOpen(isDesktop);
            }
            setData(partialMap);
          },
          onDone: (finalMap) => {
            saveCompletedMap(finalMap);
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (transformCancelledByUserRef.current) {
          setAppState('input');
          return;
        }
        setError(TRANSFORM_IDLE_TIMEOUT_MESSAGE);
        setAppState('input');
        return;
      }
      console.error(err);
      const rawMessage = err.message || '';
      const transformSourceKind =
        urlDetection?.kind === 'youtube' || urlDetection?.kind === 'link'
          ? urlDetection.kind
          : undefined;
      const friendlyMessage =
        friendlyTransformError(rawMessage, transformSourceKind) ||
        'No se pudo procesar el contenido. Revisa tu conexión o asegúrate de haber proveido una API KEY correcta en las variables de entorno.';
      setError(friendlyMessage);
      setAppState('input');
    } finally {
      setIsStreamGenerating(false);
      abortControllerRef.current = null;
    }
  };

  React.useLayoutEffect(() => {
    handleTransformRef.current = handleTransform;
  });

  const handleNewMap = () => {
    setHistoryStore((prev) => {
      const updated = setActiveId(prev, null);
      saveHistory(updated);
      return updated;
    });
    setInputText('');
    setUploadedFile(null);
    setData(null);
    setAppState('input');
    setCurrentStep(0);
    setIsComplete(false);
    setViewAll(false);
    if (!isDesktop) setIsMapOpen(false);
  };

  const resetApp = handleNewMap;

  const handleSelectHistory = (id: string) => {
    const entry = historyStore.entries.find((e) => e.id === id);
    if (!entry) return;

    const { session } = entry;
    setHistoryStore((prev) => {
      const updated = setActiveId(prev, id);
      saveHistory(updated);
      return updated;
    });
    setData(session.data);
    setCurrentStep(session.currentStep);
    setIsComplete(session.isComplete ?? false);
    setViewAll(session.viewAll ?? false);
    setAppState('result');
    setError(null);
    if (!isDesktop) setIsMapOpen(false);
    scrollPageToTop();
  };

  const handleDeleteHistory = (id: string) => {
    const wasActive = historyStore.activeId === id;

    setHistoryStore((prev) => {
      const updated = deleteEntry(prev, id);
      saveHistory(updated);
      return updated;
    });
    if (cloudUser) void deleteCloudHistoryEntry(id).catch(() => setSyncError('No se pudo eliminar el mapa de la nube.'));

    if (wasActive) {
      setData(null);
      setAppState('input');
      setCurrentStep(0);
      setIsComplete(false);
      setViewAll(false);
    }
  };

  const handleTogglePinHistory = (id: string) => {
    setHistoryStore((prev) => {
      const updated = togglePinEntry(prev, id);
      saveHistory(updated);
      return updated;
    });
  };

  const handleRenameHistory = (id: string, title: string) => {
    setHistoryStore((prev) => {
      const updated = renameEntry(prev, id, title);
      saveHistory(updated);
      if (cloudUser) {
        const entry = updated.entries.find((item) => item.id === id);
        if (entry) {
          void pushHistoryEntry(entry).catch(() =>
            setSyncError('No se pudo renombrar el mapa en la nube.')
          );
        }
      }
      return updated;
    });

    if (historyStore.activeId === id) {
      setData((prev) => (prev ? { ...prev, title } : prev));
    }
  };

  const scrollToSection = useCallback((idx: number) => {
    const id = idx === 0 ? 'section-resumen' : `section-step-${idx}`;
    const el = document.getElementById(id);
    const scrollRoot = contentRef.current;
    if (!el || !scrollRoot) return;

    scrollSpyLockRef.current = true;
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollTop = scrollRoot.scrollTop + (elRect.top - rootRect.top);
    scrollRoot.scrollTo({ top: scrollTop, behavior: 'smooth' });
    window.setTimeout(() => {
      scrollSpyLockRef.current = false;
    }, 700);
  }, []);

  const handleStepClick = useCallback(
    (idx: number) => {
      setIsComplete(false);
      setShowStepFooter(false);
      setCurrentStep(idx);
      if (!isDesktop) setIsMapOpen(false);

      if (viewAll) {
        scrollToSection(idx);
      }
    },
    [isDesktop, viewAll, scrollToSection]
  );

  React.useLayoutEffect(() => {
    if (appState !== 'result' || viewAll || isComplete) {
      setShowStepFooter(false);
      return;
    }

    setShowStepFooter(false);

    const scrollRoot = contentRef.current;
    if (!scrollRoot) return;

    scrollRoot.scrollTo({ top: 0, behavior: 'auto' });

    const SHOW_THRESHOLD = 8;
    const HIDE_THRESHOLD = 120;
    let rafId: number | null = null;
    let footerVisible = false;

    const evaluate = () => {
      const scrollHeight = scrollRoot.scrollHeight;
      const clientHeight = scrollRoot.clientHeight;
      const scrollTop = scrollRoot.scrollTop;
      const distanceFromBottom = scrollHeight - clientHeight - scrollTop;

      let nextVisible = footerVisible;
      if (!footerVisible && distanceFromBottom <= SHOW_THRESHOLD) {
        nextVisible = true;
      } else if (footerVisible && distanceFromBottom > HIDE_THRESHOLD) {
        nextVisible = false;
      }

      if (nextVisible !== footerVisible) {
        footerVisible = nextVisible;
        setShowStepFooter(nextVisible);
      }
    };

    let initRafId = requestAnimationFrame(() => {
      initRafId = requestAnimationFrame(() => {
        evaluate();
      });
    });

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        evaluate();
      });
    };

    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', evaluate);

    const resizeObserver = new ResizeObserver(evaluate);
    resizeObserver.observe(scrollRoot);

    return () => {
      scrollRoot.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', evaluate);
      resizeObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      cancelAnimationFrame(initRafId);
    };
  }, [currentStep, appState, viewAll, isComplete, data]);

  React.useLayoutEffect(() => {
    if (appState !== 'result' || viewAll || isComplete) {
      setContentBottomPad(PAGE_BOTTOM_PAD_PX);
      return;
    }

    setContentBottomPad(PAGE_BOTTOM_PAD_PX);
  }, [currentStep, appState, viewAll, isComplete]);

  React.useEffect(() => {
    if (appState !== 'result' || !viewAll || isComplete || !data?.steps) return;

    const scrollRoot = contentRef.current;
    if (!scrollRoot) return;

    const sectionIds = [
      'section-resumen',
      ...data.steps.map((_: any, i: number) => `section-step-${i + 1}`),
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollSpyLockRef.current) return;

        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;

        const topmost = visible.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best
        );

        const step = topmost.target.getAttribute('data-step');
        if (step !== null) {
          setCurrentStep(parseInt(step, 10));
        }
      },
      {
        root: scrollRoot,
        threshold: [0, 0.25, 0.5],
        rootMargin: '-15% 0px -50% 0px',
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [appState, viewAll, isComplete, data]);

  React.useEffect(() => {
    if (appState !== 'result' || isComplete || viewAll) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' && currentStep < totalSteps) {
        e.preventDefault();
        handleStepClick(currentStep + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        e.preventDefault();
        handleStepClick(currentStep - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, currentStep, totalSteps, isComplete, viewAll, handleStepClick]);

  const toggleViewMode = () => {
    setViewAll((v) => !v);
    setIsComplete(false);
    scrollPageToTop();
    if (!isDesktop) setIsMapOpen(false);
  };

  const renderViewModeToggle = (className = '') => (
    <button
      onClick={toggleViewMode}
      className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${viewAll ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20' : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'} ${className}`}
    >
      {viewAll ? <List className="w-4 h-4 shrink-0" /> : <Layers className="w-4 h-4 shrink-0" />}
      {viewAll ? 'Paso a paso' : 'Ver todo'}
    </button>
  );

  const renderProfileMenu = (align: 'up' | 'right') => {
    if (!profileMenuOpen) return null;

    const positionClass =
      align === 'up' ? 'bottom-full left-0 mb-2' : 'left-full bottom-0 ml-2';

    return (
      <div
        className={`absolute z-[60] w-72 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden ${positionClass}`}
        role="menu"
      >
        <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-white/10">
          <p className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">Modelo</p>
        </div>
        <div className="py-1 max-h-52 overflow-y-auto">
          {MODEL_OPTIONS.map((option) => {
            const isActive = modelPreference === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={appState === 'loading'}
                onClick={() => {
                  setModelPreference(option.id);
                  saveModelPreference(option.id);
                }}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors disabled:opacity-50 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/10'
                    : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {option.label}
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {option.hint}
                  </span>
                </span>
                {isActive && <Check className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />}
              </button>
            );
          })}
        </div>
        <div className="border-t border-neutral-200 dark:border-white/10">
          <div className="px-3 py-2.5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">Experiencia</p>
          </div>
          <div className="py-1">
            {APP_VARIANT_OPTIONS.map((option) => {
              const isActive = getAppVariant() === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  disabled={appState === 'loading'}
                  onClick={() => {
                    if (isActive) return;
                    setProfileMenuOpen(false);
                    switchAppVariant(option.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors disabled:opacity-50 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-500/10'
                      : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      {option.label}
                    </span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {option.hint}
                    </span>
                  </span>
                  {isActive && <Check className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-neutral-200 dark:border-white/10 py-1">
          {isCloudSyncConfigured && !cloudUser && (
            <>
              <p className="px-3 pt-2 text-[10px] font-bold tracking-widest uppercase text-neutral-400">Sincronización</p>
              <div className="px-3 py-2 space-y-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void signInWith('google')}
                  className="w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                >
                  Continuar con Google
                </button>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center leading-snug">
                  Un clic. La sesión queda guardada en este navegador.
                </p>
              </div>
              <form
                className="px-3 py-2 space-y-2 border-t border-neutral-200 dark:border-white/10"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAuthError(null);
                  setAuthBusy(true);
                  const action = authIsSignUp
                    ? signUpWithPassword(authEmail, authPassword)
                    : signInWithPassword(authEmail, authPassword);
                  void action
                    .then(() => {
                      setAuthPassword('');
                      setProfileMenuOpen(false);
                    })
                    .catch((err) => setAuthError(authErrorMessage(err)))
                    .finally(() => setAuthBusy(false));
                }}
              >
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">O con email y contraseña</p>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={authIsSignUp ? 'new-password' : 'current-password'}
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Contraseña (mín. 6)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-2.5 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {authBusy ? 'Entrando…' : authIsSignUp ? 'Crear cuenta' : 'Entrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthIsSignUp((value) => !value);
                    setAuthError(null);
                  }}
                  className="w-full text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {authIsSignUp ? '¿Ya tienes cuenta? Entrar' : '¿Primera vez? Crear cuenta'}
                </button>
                {authError && <p className="text-xs text-red-500">{authError}</p>}
              </form>
            </>
          )}
          {cloudUser && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                Cuenta conectada
              </p>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300 truncate">
                {cloudUser.email ?? 'tu cuenta'}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                Tu historial se sincroniza entre dispositivos.
              </p>
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              toggleTheme();
              setProfileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-neutral-400 cursor-not-allowed"
          >
            <Settings className="w-4 h-4" />
            Ajustes
          </button>
          {cloudUser && <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>}
        </div>
      </div>
    );
  };

  const profileTitle = cloudUser
    ? `Sincronizado como ${cloudUser.email ?? 'tu cuenta'}`
    : 'Cuenta y ajustes';

  const renderProfileTrigger = (variant: 'compact' | 'expanded') => (
    <div className="relative" ref={profileMenuRef}>
      <button
        type="button"
        onClick={() => setProfileMenuOpen((open) => !open)}
        className={`rounded-xl transition-colors hover:bg-neutral-200/50 dark:hover:bg-white/5 ${
          variant === 'compact' ? 'p-1' : 'p-1'
        }`}
        aria-expanded={profileMenuOpen}
        aria-haspopup="menu"
        title={profileTitle}
        aria-label={profileTitle}
      >
        <ProfileAvatar
          email={cloudUser?.email}
          avatarUrl={cloudUser?.avatarUrl}
          signedIn={Boolean(cloudUser)}
        />
      </button>
      {renderProfileMenu(variant === 'compact' ? 'right' : 'up')}
    </div>
  );

  const renderCollapsedRail = () => (
    <div className="hidden lg:flex flex-col h-full w-14 shrink-0 items-center py-5">
      <button
        type="button"
        onClick={toggleSidebar}
        className="mb-5 p-2 rounded-xl text-[#1A1A1A] dark:text-[#EDEDED] hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
        title="Abrir panel lateral"
        aria-label="Abrir panel lateral"
      >
        <AppIcon className="w-7 h-7" />
      </button>
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleNewMap}
          className="p-2.5 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
          title="Nuevo mapa"
          aria-label="Nuevo mapa"
        >
          <SquarePen className="w-5 h-5" />
        </button>
        <button
          onClick={toggleSidebar}
          className="p-2.5 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
          title="Historial"
          aria-label="Abrir historial"
        >
          <History className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-auto pb-2">{renderProfileTrigger('compact')}</div>
    </div>
  );

  const renderSidebarBrand = (mobile = false) => (
    <div className={`flex items-center justify-between gap-2${mobile ? '' : ' mb-10'}`}>
      <button
        type="button"
        onClick={handleNewMap}
        className="flex items-center gap-2 min-w-0 rounded-lg -ml-1 px-1 py-0.5 text-left hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
        title="Ir a inicio"
        aria-label="Ir a inicio"
      >
        <AppIcon className="w-8 h-8 shrink-0 text-[#1A1A1A] dark:text-[#EDEDED]" />
        <span className="text-xl font-semibold text-[#1A1A1A] dark:text-[#EDEDED] tracking-tight">
          Nucleo
        </span>
      </button>
      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden lg:inline-flex p-2 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
        title="Cerrar panel lateral"
        aria-label="Cerrar panel lateral"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const renderSidebar = () => (
    <aside
      className={`fixed left-0 inset-y-0 z-10 shrink-0 bg-neutral-50 dark:bg-app-canvas border-r-0 lg:border-r lg:border-neutral-200 lg:dark:border-white/5 pb-[env(safe-area-inset-bottom)] w-[var(--mobile-sidebar-width)] select-none [webkit-user-select:none] [webkit-touch-callout:none] lg:pb-0 lg:sticky lg:top-0 lg:bottom-auto lg:h-dvh lg:self-start lg:z-40 lg:w-auto ${
        showSidebarExpanded
          ? `flex flex-col overflow-hidden lg:w-72${!isDesktop && !isMapOpen ? ' pointer-events-none' : ''}`
          : 'pointer-events-none lg:pointer-events-auto lg:overflow-visible lg:w-14'
      }`}
      aria-hidden={!showSidebarExpanded && !isDesktop}
    >
      {showSidebarExpanded ? (
      <div className="sidebar-shell relative flex flex-col h-full min-h-0 w-full lg:w-72 isolate overflow-hidden">
        <div className="mobile-sidebar relative flex-1 min-h-0 w-full lg:hidden">
          <div className="sidebar-scroll overscroll-y-contain touch-pan-y select-none [webkit-user-select:none] [webkit-touch-callout:none]">
            <div className="sidebar-list px-6">
              {appState === 'result' && data && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => setIsIndexExpanded((prev) => !prev)}
                    className="w-full flex items-center gap-2 mb-4 text-left rounded-lg -mx-2 px-2 py-1 hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
                    aria-expanded={isIndexExpanded}
                  >
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform ${isIndexExpanded ? '' : '-rotate-90'}`}
                    />
                    <span className="text-xs font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-400">
                      Índice
                    </span>
                  </button>

                  {isIndexExpanded && (
                    <>
                  <nav className="flex flex-col gap-1">
                    <button
                      onClick={() => handleStepClick(0)}
                      className={`text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-between group ${currentStep === 0 && !isComplete ? 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/5'}`}
                    >
                      <span>Resumen</span>
                    </button>

                    <div className="w-px h-6 bg-neutral-200 dark:bg-white/5 ml-8 my-1" />

                    {data?.steps?.map((step: any, idx: number) => {
                      const stepNum = idx + 1;
                      const isActive = currentStep === stepNum && !isComplete;
                      const isPast = currentStep > stepNum || isComplete;
                      return (
                        <button
                          key={step.id}
                          onClick={() => handleStepClick(stepNum)}
                          className={`text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-between group ${isActive ? 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/5'}`}
                        >
                          <span className="flex items-center gap-3 min-w-0 lg:flex-1 lg:pr-6">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-500 dark:text-neutral-400">
                              {stepNum}
                            </span>
                            <span className="truncate">{step.shortNav}</span>
                          </span>
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isPast ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </nav>

                  {!isComplete && renderViewModeToggle('mt-4')}
                    </>
                  )}
                </div>
              )}

              {storageError && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 px-1">{storageError}</p>
              )}
              {syncError && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 px-1">{syncError}</p>
              )}

              <HistoryPanel
                entries={historyStore.entries}
                activeId={historyStore.activeId}
                disabled={appState === 'loading'}
                showTopDivider={appState === 'result' && Boolean(data)}
                onSelect={handleSelectHistory}
                onDelete={handleDeleteHistory}
                onTogglePin={handleTogglePinHistory}
                onRename={handleRenameHistory}
              />
            </div>
          </div>
          <header className="sidebar-header px-6">{renderSidebarBrand(true)}</header>
        </div>

        <div className="hidden lg:flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-y-contain touch-pan-y px-6 pt-8 select-none [webkit-user-select:none] [webkit-touch-callout:none]">
          {renderSidebarBrand()}

          {appState === 'result' && data && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setIsIndexExpanded((prev) => !prev)}
                className="w-full flex items-center gap-2 mb-4 text-left rounded-lg -mx-2 px-2 py-1 hover:bg-neutral-200/50 dark:hover:bg-white/5 transition-colors"
                aria-expanded={isIndexExpanded}
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform ${isIndexExpanded ? '' : '-rotate-90'}`}
                />
                <span className="text-xs font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-400">
                  Índice
                </span>
              </button>

              {isIndexExpanded && (
                <>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => handleStepClick(0)}
                  className={`text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-between group ${currentStep === 0 && !isComplete ? 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/5'}`}
                >
                  <span>Resumen</span>
                </button>

                <div className="w-px h-6 bg-neutral-200 dark:bg-white/5 ml-8 my-1" />

                {data?.steps?.map((step: any, idx: number) => {
                  const stepNum = idx + 1;
                  const isActive = currentStep === stepNum && !isComplete;
                  const isPast = currentStep > stepNum || isComplete;
                  return (
                    <button
                      key={step.id}
                      onClick={() => handleStepClick(stepNum)}
                      className={`text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-between group ${isActive ? 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/5'}`}
                    >
                      <span className="flex items-center gap-3 min-w-0 lg:flex-1 lg:pr-6">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-500 dark:text-neutral-400">
                          {stepNum}
                        </span>
                        <span className="truncate">{step.shortNav}</span>
                      </span>
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isPast ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </nav>

              {!isComplete && renderViewModeToggle('mt-4')}
                </>
              )}
            </div>
          )}

          {storageError && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 px-1">{storageError}</p>
          )}
          {syncError && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 px-1">{syncError}</p>
          )}

          <HistoryPanel
            entries={historyStore.entries}
            activeId={historyStore.activeId}
            disabled={appState === 'loading'}
            showTopDivider={appState === 'result' && Boolean(data)}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onTogglePin={handleTogglePinHistory}
            onRename={handleRenameHistory}
          />
        </div>

        <div className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 bg-neutral-50 dark:bg-app-canvas">
          <div className="flex items-center justify-between gap-3">
            {renderProfileTrigger('expanded')}
            <button
              onClick={handleNewMap}
              className="group relative overflow-hidden flex items-center gap-2 py-2 px-4 rounded-full font-semibold text-[#1A1A1A] dark:text-[#EDEDED] bg-white/50 dark:bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/40 dark:border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300 hover:bg-white/70 dark:hover:bg-white/15 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] active:scale-[0.97] shrink-0"
              title="Nuevo mapa"
              aria-label="Nuevo mapa"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent opacity-70 dark:from-white/20"
              />
              <SquarePen className="relative w-4 h-4" />
              <span className="relative">Nuevo mapa</span>
            </button>
          </div>
        </div>
      </div>
      ) : (
        renderCollapsedRail()
      )}
    </aside>
  );

  const renderContentBlock = (block: any, idx: number) => {
    const type = String(block.type || 'prose').toLowerCase();
    const textContent = block.text || block.description || block.content || '';

    switch (type) {
      case 'callout': {
        const kind = String(block.kind || 'info').toLowerCase();
        const colors: Record<string, string> = {
          action:
            'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-900 dark:text-emerald-100',
          info: 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 text-blue-900 dark:text-blue-100',
          alert:
            'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-100',
        };
        const Icons: Record<string, any> = {
          action: CheckCircle2,
          info: Info,
          alert: AlertTriangle,
        };
        const Icon = Icons[kind] || Info;
        return (
          <div
            key={idx}
            className={`pl-5 py-4 border-l-4 my-8 flex gap-4 items-start content-prose ${colors[kind] || colors.info}`}
          >
            <Icon className="w-6 h-6 shrink-0 mt-0.5 opacity-80" />
            <p className="font-medium text-lg m-0 leading-relaxed text-pretty">
              {textContent || 'Presta atención a este punto clave.'}
            </p>
          </div>
        );
      }
      case 'list':
        return (
          <div key={idx} className="my-10 content-prose">
            {textContent && (
              <p className="text-neutral-800 dark:text-neutral-200 text-lg sm:text-xl leading-[1.65] mb-8 text-pretty">
                {textContent}
              </p>
            )}
            {block.items?.length > 0 && (
              <ul className="space-y-6">
                {block.items.map((item: any, i: number) => (
                  <li key={i} className="flex gap-4 items-start">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2.5 shrink-0" />
                    <div className="text-lg sm:text-xl leading-[1.65] text-pretty">
                      <strong className="text-[#1A1A1A] dark:text-[#EDEDED] font-bold">
                        {item.strong}
                      </strong>
                      {item.span && (
                        <span className="text-neutral-700 dark:text-neutral-300 ml-2">
                          {item.span}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      default:
        if (!textContent.trim()) return null;
        return (
          <p
            key={idx}
            className="text-neutral-800 dark:text-neutral-200 text-lg sm:text-xl leading-[1.65] my-8 content-prose text-pretty"
          >
            {textContent}
          </p>
        );
    }
  };

  const renderResumen = () => (
    <div
      id="section-resumen"
      data-step="0"
      className={`animate-slide-up content-column scroll-mt-28 ${viewAll ? 'mb-20 pb-12 border-b border-neutral-200 dark:border-white/5' : ''}`}
    >
      <div className="mb-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
          <div className="flex items-center gap-2">
            <AppIcon className="w-5 h-5 text-[#1A1A1A] dark:text-[#EDEDED]" />
            <span className="text-sm font-bold tracking-widest uppercase text-[#1A1A1A] dark:text-[#EDEDED]">
              El Nucleo
            </span>
          </div>
          {!isComplete && totalMinutes !== null && (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              <Clock className="w-4 h-4" aria-hidden="true" />
              ~{totalMinutes} min
            </p>
          )}
        </div>
        <h2 className="heading-core text-[#1A1A1A] dark:text-[#EDEDED] mb-6">
          <BalancedText>{data?.coreIdea}</BalancedText>
        </h2>
        <p className="text-xl sm:text-2xl leading-[1.65] text-neutral-700 dark:text-neutral-400 content-prose text-pretty">
          {data?.coreSupport}
        </p>
      </div>

      <div className={`border-t border-neutral-200 dark:border-white/5 pt-12${viewAll ? ' pb-8' : ''}`}>
        <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-400 mb-10">
          Desglose Rápido (TL;DR)
        </h3>
        <div className="grid gap-10">
          {data?.tldr?.map((item: any, i: number) => (
            <div key={i} className="flex gap-6 items-start group">
              <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-neutral-200 dark:border-white/10 flex items-center justify-center text-sm font-bold text-neutral-400 group-hover:border-indigo-500 group-hover:text-indigo-500 transition-colors">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-[#1A1A1A] dark:text-[#EDEDED] text-lg sm:text-xl font-bold mb-3">
                  {item.title}
                </strong>
                <p className="text-neutral-700 dark:text-neutral-300 text-base sm:text-lg leading-[1.65] content-prose text-pretty">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep = (stepIndex: number) => {
    const step = data?.steps[stepIndex - 1];
    if (!step) return null;

    return (
      <div
        id={`section-step-${stepIndex}`}
        data-step={stepIndex}
        key={step.id || stepIndex}
        className={
          viewAll
            ? 'mb-20 pb-12 border-b border-neutral-200 dark:border-white/5 last:mb-0 last:pb-0 last:border-0 scroll-mt-28 content-column'
            : 'animate-slide-right content-column'
        }
      >
        <div className={viewAll ? 'mb-12' : undefined}>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-sm">
              Paso {stepIndex} de {totalSteps}
            </span>
            {step.time && (
              <>
                <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                <span className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
                  {step.time}
                </span>
              </>
            )}
          </div>

          <h2 className="heading-step text-[#1A1A1A] dark:text-[#EDEDED] mb-12">
            {step.title}
          </h2>

          <div className="mt-8">
            {step.content?.map((block: any, idx: number) => renderContentBlock(block, idx))}
          </div>
        </div>
      </div>
    );
  };

  const renderStepNavFooter = () => {
    if (viewAll || isComplete) return null;

    if (currentStep === 0) {
      return (
        <div className="shrink-0 border-t border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-app-canvas px-4 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => handleStepClick(1)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
              Empezar a leer <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      );
    }

    const stepIndex = currentStep;

    return (
      <div className="shrink-0 border-t border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-app-canvas px-4 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex gap-4">
          <button
            onClick={() => handleStepClick(stepIndex - 1)}
            className="flex-1 bg-transparent text-neutral-700 dark:text-neutral-300 p-4 rounded-xl font-bold border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors flex justify-center"
          >
            Atrás
          </button>

          {stepIndex < totalSteps ? (
            <button
              onClick={() => handleStepClick(stepIndex + 1)}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
              Siguiente <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsComplete(true);
                scrollPageToTop();
              }}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
            >
              <Check className="w-6 h-6" /> Finalizar
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCompletion = () => (
    <div className="animate-celebrate content-column text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/15 mb-8">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A1A] dark:text-[#EDEDED] mb-4">
        ¡Lo lograste!
      </h2>
      <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-10 content-prose mx-auto text-pretty">
        Has completado los {totalSteps} pasos de este mapa de acción.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
        <button
          onClick={() => {
            setIsComplete(false);
            handleStepClick(0);
          }}
          className="px-8 py-4 rounded-xl font-bold border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
        >
          Repasar desde el inicio
        </button>
        <button
          onClick={resetApp}
          className="px-8 py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        >
          <SquarePen className="w-5 h-5" /> Nuevo mapa
        </button>
      </div>
    </div>
  );

  const renderMapTitle = () => (
    <div className="mb-12">
      <h1 className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-widest min-w-0 leading-snug text-pretty">
        {data?.title}
      </h1>
      {isStreamGenerating && (
        <p className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300 animate-pulse">
          Generando mapa…
        </p>
      )}
    </div>
  );

  const renderProgressBar = () => (
    <ReadingProgressBar
      active={appState === 'result'}
      viewAll={viewAll}
      isComplete={isComplete}
      stepProgress={progress}
      progressLabel={progressLabel}
      scrollContainer={contentRef}
      onToggleSidebar={toggleSidebar}
    />
  );

  const renderInputContent = () => {
    const canSubmit = Boolean(inputText.trim() || uploadedFile);
    const composerPlaceholder = uploadedFile?.isImage
      ? 'Añade una indicación (opcional)…'
      : uploadedFile
        ? 'Archivo adjunto listo para transformar'
        : 'Pega texto, un enlace de YouTube o una transcripción…';
    const hideTextInput = Boolean(uploadedFile?.isPdf);

    return (
      <div
        className="app-shell flex-1 relative flex flex-col bg-app-canvas"
        style={
          {
            '--composer-reserved-height': `${isNativeIOS ? nativeComposerReservedHeight : 184}px`,
          } as React.CSSProperties
        }
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute left-6 top-4 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-500/10 text-neutral-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:bg-neutral-500/20 dark:text-neutral-400 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all active:scale-95 shrink-0"
          title="Abrir navegación"
          aria-label="Abrir navegación"
        >
          <MenuTwoLines className="w-4.5 h-4.5" />
        </button>
        <div className="home-center-stage flex-1 min-h-0 flex flex-col">
        <div ref={contentRef} className="page-scroll flex-1 flex flex-col items-center justify-center px-4 sm:px-8 lg:flex-none">
          <div
            className="home-hero-copy text-center space-y-2 sm:space-y-3 max-w-lg select-none"
            onSelectStart={(e) => e.preventDefault()}
          >
            <div className="inline-flex items-center justify-center mb-1">
              <NucleoIcon className="text-[#1A1A1A] dark:text-[#EDEDED]" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-[#1A1A1A] dark:text-[#EDEDED] leading-[1.1]">
              ¿Qué me cuentas?
            </h1>
            <p className="text-sm sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Convierte{' '}
              <strong className="text-[#1A1A1A] dark:text-[#EDEDED]">
                caos en mapas de acción
              </strong>
              . Directo al punto.
            </p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">
              PREVIEW MOBILE OK
            </p>
          </div>

          {error && (
            <div className="mt-6 w-full max-w-3xl p-4 bg-neutral-50 dark:bg-neutral-900/50 text-[#1A1A1A] dark:text-[#EDEDED] rounded-2xl border border-neutral-200 dark:border-white/5 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="font-medium text-sm">{error}</p>
            </div>
          )}
        </div>

        {!isNativeIOS && (
        <div className="composer-dock">
          <div className="max-w-3xl mx-auto lg:max-w-none lg:mx-0">
            <div className="rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-app-surface shadow-sm dark:shadow-none">
              {uploadedFile && (
                <div className="flex items-center gap-2 px-3 pt-3">
                  {uploadedFile.isImage && uploadedFile.previewUrl ? (
                    <div className="relative group">
                      <img
                        src={uploadedFile.previewUrl}
                        alt={uploadedFile.name}
                        className="w-16 h-16 rounded-xl object-cover border border-neutral-200 dark:border-white/10"
                      />
                      <button
                        type="button"
                        onClick={removeFile}
                        className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-neutral-800 text-white shadow-md hover:bg-neutral-700 transition-colors"
                        aria-label="Quitar imagen"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 max-w-full px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-white/5 text-sm text-neutral-700 dark:text-neutral-300">
                      <File className="w-4 h-4 shrink-0 opacity-70" />
                      <span className="truncate max-w-[220px]">{uploadedFile.name}</span>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                        aria-label="Quitar archivo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!hideTextInput && (
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    adjustComposerHeight(e.target);
                  }}
                  rows={1}
                  placeholder={composerPlaceholder}
                  className="w-full min-h-[4.75rem] max-h-[200px] px-4 py-3 bg-transparent resize-none outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 text-base leading-snug"
                />
              )}

              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="relative" ref={attachMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((open) => !open)}
                    className={`p-2.5 rounded-full transition-colors ${
                      attachMenuOpen
                        ? 'bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-neutral-200'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5'
                    }`}
                    title="Adjuntar"
                    aria-label="Adjuntar"
                    aria-haspopup="menu"
                    aria-expanded={attachMenuOpen}
                  >
                    <Plus
                      className={`w-5 h-5 transition-transform ${attachMenuOpen ? 'rotate-45' : ''}`}
                    />
                  </button>

                  {attachMenuOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full left-0 mb-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-xl p-2 animate-fade-in"
                    >
                      <div className="px-1 pt-1 pb-2">
                        <p className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Recientes
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          <button
                            type="button"
                            onClick={() => {
                              imageInputRef.current?.click();
                              setAttachMenuOpen(false);
                            }}
                            className="shrink-0 w-14 h-14 rounded-lg border border-dashed border-neutral-300 dark:border-white/20 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-400 dark:hover:border-white/30 transition-colors"
                            title="Elegir imagen"
                            aria-label="Elegir imagen"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                          {recentImages.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => attachRecentImage(url)}
                              className="shrink-0 rounded-lg overflow-hidden border border-neutral-200 dark:border-white/10 hover:ring-2 hover:ring-indigo-400/50 transition-all"
                              title="Adjuntar imagen reciente"
                            >
                              <img src={url} alt="" className="w-14 h-14 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          cameraInputRef.current?.click();
                          setAttachMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <Camera className="w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        Cámara
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <Paperclip className="w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        Añadir archivo
                      </button>
                    </div>
                  )}
                </div>

                <button
                  id="hidden-submit-btn"
                  type="button"
                  onClick={handleTransform}
                  disabled={!canSubmit || appState === 'loading'}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 select-none shrink-0 ${
                    canSubmit && appState !== 'loading'
                      ? 'bg-indigo-500/15 text-indigo-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:bg-indigo-400/20 dark:text-indigo-300 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                      : 'bg-neutral-500/10 text-neutral-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:bg-neutral-500/20 dark:text-neutral-500 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                  }`}
                  title="Transformar"
                  aria-label="Transformar"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
        </div>
      </div>
    );
  };

  const renderLoadingContent = () => (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className={mainScrollAreaClass}>
        <LoadingState />
      </div>
      <div className="shrink-0 border-t border-neutral-200 dark:border-white/5 bg-app-canvas px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex justify-center">
          <button
            onClick={handleCancel}
            className="px-6 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  const isMobileDrawerScene = isSidebarUnderlayVisible;
  const isMainScrollLocked = !isDesktop && isSidebarDragging;
  const mainScrollAreaClass = isMainScrollLocked
    ? 'flex-1 min-h-0 overflow-hidden overscroll-none touch-none'
    : 'flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y';

  return (
    <div
      className={`relative h-dvh max-h-[100dvh] overflow-hidden flex flex-col lg:flex-row transition-colors duration-300 lg:pt-[env(safe-area-inset-top)] ${
        isMobileDrawerScene ? 'bg-neutral-50 dark:bg-app-canvas' : 'bg-app-canvas'
      }`}
      style={{ '--mobile-sidebar-width': 'min(82vw, 360px)' } as React.CSSProperties}
    >
      {isMobileDrawerScene && (
        <div
          className="fixed inset-0 z-[5] pointer-events-none lg:hidden bg-neutral-50 dark:bg-app-canvas"
          aria-hidden="true"
        />
      )}
      {renderSidebar()}

      <main
        ref={mainRef}
        className={`fixed inset-0 z-20 h-dvh max-h-[100dvh] w-full flex flex-col overflow-hidden bg-app-canvas will-change-transform lg:relative lg:inset-auto lg:flex-1 lg:min-h-0 lg:min-w-0 lg:h-auto lg:max-h-none ${
          isMainScrollLocked ? 'touch-none overscroll-none' : ''
        } lg:touch-auto`}
        style={mainSheetStyle}
        onClickCapture={handleMainClickCapture}
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={(e) => {
          if (!isDesktop && (isMapOpen || sidebarTouchStartRef.current)) {
            e.stopPropagation();
          }
          handleMainTouchEnd();
        }}
        onTouchCancel={(e) => {
          if (!isDesktop && (isMapOpen || sidebarTouchStartRef.current)) {
            e.stopPropagation();
          }
          handleMainTouchEnd();
        }}
      >
        <div className="flex flex-col flex-1 min-h-0 h-full pt-[env(safe-area-inset-top)] lg:pt-0">
        {appState === 'input' && renderInputContent()}

        {appState === 'loading' && renderLoadingContent()}

        {appState === 'result' && !viewAll && !isComplete && (
          <div className="flex flex-col flex-1 min-h-0 w-full">
            {renderProgressBar()}

            <div className="flex flex-col flex-1 min-h-0">
              <div
                ref={contentRef}
                className={mainScrollAreaClass}
              >
                <div
                  className="max-w-3xl mx-auto px-6 py-8 w-full"
                  style={{
                    paddingBottom: `${contentBottomPad}px`,
                  }}
                >
                  {currentStep === 0 && renderMapTitle()}

                  {currentStep === 0 && renderResumen()}
                  {currentStep > 0 && renderStep(currentStep)}
                </div>
              </div>

              {shouldShowStepFooter && (
                <motion.div
                  className="shrink-0"
                  initial={false}
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : { y: 0, opacity: 1 }
                  }
                  transition={
                    reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }
                  }
                >
                  <div ref={stepFooterRef}>{renderStepNavFooter()}</div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {appState === 'result' && (viewAll || isComplete) && (
          <div className="flex flex-col flex-1 min-h-0 w-full">
            {renderProgressBar()}

            <div ref={contentRef} className={mainScrollAreaClass}>
              <div
                className={`max-w-3xl mx-auto px-6 py-8 w-full ${
                  viewAll
                    ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]'
                    : 'pb-[calc(8rem+env(safe-area-inset-bottom))]'
                }`}
              >
                {renderMapTitle()}

                {isComplete ? (
                  renderCompletion()
                ) : (
                  <div className="animate-fade-in">
                    {renderResumen()}
                    {data?.steps?.map((_: any, idx: number) => renderStep(idx + 1))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Hidden inputs for file/image picking, kept outside conditional renders so native bridge can access them */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.pdf"
        onChange={handleFileUpload}
        className="hidden"
        title="Subir archivo de texto o PDF"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
        title="Hacer una foto"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        title="Elegir imagen"
      />
    </div>
  );
}
