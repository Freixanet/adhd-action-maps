import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Link2,
  Youtube,
  Upload,
  File,
  Pin,
  PinOff,
  Pencil,
  X,
} from 'lucide-react';
import {
  formatRelativeDate,
  type HistoryEntry,
  type SourceType,
} from '../history';

type HistoryPanelProps = {
  entries: HistoryEntry[];
  activeId: string | null;
  disabled?: boolean;
  showTopDivider?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename?: (id: string, title: string) => void;
};

type ActionMenuState = {
  entry: HistoryEntry;
  top: number;
  left: number;
  width: number;
};

const SOURCE_ICONS: Record<SourceType, typeof FileText> = {
  text: FileText,
  link: Link2,
  youtube: Youtube,
  file: Upload,
  pdf: File,
};

const LONG_PRESS_MS = 380;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

function clearDocumentSelection(): void {
  if (typeof window === 'undefined') return;
  window.getSelection()?.removeAllRanges();
}

function preventNativeSelection(event: SyntheticEvent): void {
  event.preventDefault();
}

function triggerHistoryItemHaptic(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(12);
  }
}

function sortPinnedEntries(entries: HistoryEntry[]) {
  return [...entries].sort(
    (a, b) => (b.pinnedAt ?? b.updatedAt) - (a.pinnedAt ?? a.updatedAt)
  );
}

export default function HistoryPanel({
  entries,
  activeId,
  disabled = false,
  showTopDivider = false,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: HistoryPanelProps) {
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const [renamingEntryId, setRenamingEntryId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const scrollIntentRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressTargetRef = useRef<HTMLButtonElement | null>(null);
  const pressEntryRef = useRef<HistoryEntry | null>(null);
  const bodyUserSelectRef = useRef<{ userSelect: string; webkitUserSelect: string } | null>(null);
  const releaseSelectionGuardRef = useRef<(() => void) | null>(null);

  const pinnedEntries = useMemo(
    () => sortPinnedEntries(entries.filter((entry) => entry.pinned)),
    [entries]
  );

  const recentEntries = useMemo(
    () =>
      [...entries]
        .filter((entry) => !entry.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [entries]
  );

  useEffect(() => {
    if (!actionMenu) return;

    const closeMenu = () => setActionMenu(null);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [actionMenu]);

  useEffect(() => {
    if (!renamingEntryId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingEntryId]);

  const lockBodySelection = () => {
    if (typeof document === 'undefined' || bodyUserSelectRef.current) return;
    bodyUserSelectRef.current = {
      userSelect: document.body.style.userSelect,
      webkitUserSelect: document.body.style.webkitUserSelect,
    };
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  };

  const unlockBodySelection = () => {
    if (typeof document === 'undefined' || !bodyUserSelectRef.current) return;
    document.body.style.userSelect = bodyUserSelectRef.current.userSelect;
    document.body.style.webkitUserSelect = bodyUserSelectRef.current.webkitUserSelect;
    bodyUserSelectRef.current = null;
  };

  const disableSelectionGuard = () => {
    releaseSelectionGuardRef.current?.();
    releaseSelectionGuardRef.current = null;
  };

  const enableSelectionGuard = () => {
    disableSelectionGuard();
    clearDocumentSelection();

    const prevent = (event: Event) => {
      event.preventDefault();
      clearDocumentSelection();
    };
    const onSelectionChange = () => clearDocumentSelection();

    document.addEventListener('selectstart', prevent, true);
    document.addEventListener('contextmenu', prevent, true);
    document.addEventListener('selectionchange', onSelectionChange, true);

    releaseSelectionGuardRef.current = () => {
      document.removeEventListener('selectstart', prevent, true);
      document.removeEventListener('contextmenu', prevent, true);
      document.removeEventListener('selectionchange', onSelectionChange, true);
    };
  };

  const endPressGesture = () => {
    disableSelectionGuard();
    unlockBodySelection();
    clearDocumentSelection();
  };

  useEffect(() => {
    return () => {
      disableSelectionGuard();
      unlockBodySelection();
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const resetPressState = () => {
    clearLongPress();
    pressStartRef.current = null;
    pressTargetRef.current = null;
    pressEntryRef.current = null;
  };

  const openActionMenu = (entry: HistoryEntry, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 160);
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 12);

    setActionMenu({
      entry,
      top: Math.min(rect.bottom + 6, window.innerHeight - 56),
      left: Math.max(12, left),
      width: menuWidth,
    });
  };

  const triggerLongPress = () => {
    const entry = pressEntryRef.current;
    const target = pressTargetRef.current;
    if (!entry || !target) return;

    longPressTriggeredRef.current = true;
    suppressClickRef.current = true;
    enableSelectionGuard();
    clearDocumentSelection();
    triggerHistoryItemHaptic();
    openActionMenu(entry, target);
  };

  const handleEntryPointerDown = (entry: HistoryEntry, e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;

    longPressTriggeredRef.current = false;
    scrollIntentRef.current = false;
    lockBodySelection();
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressTargetRef.current = e.currentTarget;
    pressEntryRef.current = entry;
    clearLongPress();

    longPressTimerRef.current = window.setTimeout(triggerLongPress, LONG_PRESS_MS);
  };

  const handleEntryPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (longPressTriggeredRef.current) {
      clearDocumentSelection();
      return;
    }

    if (!pressStartRef.current || longPressTimerRef.current === null) return;

    const dx = e.clientX - pressStartRef.current.x;
    const dy = e.clientY - pressStartRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      clearLongPress();
      scrollIntentRef.current = true;
    }
  };

  const handleEntryPointerUp = () => {
    clearLongPress();
    endPressGesture();

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      resetPressState();
      return;
    }

    resetPressState();
  };

  const handleEntryPointerCancel = () => {
    clearLongPress();
    longPressTriggeredRef.current = false;
    endPressGesture();
    resetPressState();
  };

  const handleEntryClick = (entryId: string) => {
    if (disabled || suppressClickRef.current || scrollIntentRef.current) {
      suppressClickRef.current = false;
      scrollIntentRef.current = false;
      return;
    }

    onSelect(entryId);
  };

  const handleEntryContextMenu = (entry: HistoryEntry, e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    suppressClickRef.current = true;
    openActionMenu(entry, e.currentTarget);
  };

  const handleTogglePinFromMenu = () => {
    if (!actionMenu) return;
    onTogglePin(actionMenu.entry.id);
    setActionMenu(null);
  };

  const startRename = (entry: HistoryEntry) => {
    setRenamingEntryId(entry.id);
    setRenameDraft(entry.title);
    setActionMenu(null);
  };

  const cancelRename = () => {
    setRenamingEntryId(null);
    setRenameDraft('');
  };

  const commitRename = (entry: HistoryEntry) => {
    const trimmed = renameDraft.trim();
    cancelRename();
    if (!onRename || !trimmed || trimmed === entry.title) return;
    onRename(entry.id, trimmed);
  };

  const renderEntryItem = (entry: HistoryEntry) => {
    const Icon = SOURCE_ICONS[entry.sourceType] || FileText;
    const isActive = entry.id === activeId;
    const isPinned = Boolean(entry.pinned);
    const isRenaming = renamingEntryId === entry.id;

    return (
      <li key={entry.id} className="group relative">
        <button
          type="button"
          onPointerDown={(e) => {
            if (isRenaming) return;
            handleEntryPointerDown(entry, e);
          }}
          onPointerMove={handleEntryPointerMove}
          onPointerUp={handleEntryPointerUp}
          onPointerCancel={handleEntryPointerCancel}
          onClick={() => {
            if (isRenaming) return;
            handleEntryClick(entry.id);
          }}
          onContextMenu={(e) => handleEntryContextMenu(entry, e)}
          onSelectStart={preventNativeSelection}
          disabled={disabled}
          className={`w-full text-left px-3 py-2.5 pr-9 rounded-lg transition-all flex items-start gap-2.5 select-none [webkit-user-select:none] touch-pan-y [webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] disabled:opacity-50 disabled:pointer-events-none ${
            isActive
              ? 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
              : isPinned
                ? 'bg-indigo-50/90 text-neutral-700 dark:bg-indigo-500/10 dark:text-neutral-200 hover:bg-indigo-100/80 dark:hover:bg-indigo-500/15'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/5'
          } ${actionMenu?.entry.id === entry.id ? 'ring-2 ring-indigo-400/40 dark:ring-indigo-500/30' : ''}`}
        >
          <Icon className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
          <span className="min-w-0 flex-1">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename(entry);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={() => commitRename(entry)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full rounded-md border border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-neutral-900 px-2 py-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100 outline-none select-text [webkit-user-select:text]"
                aria-label="Nuevo nombre del mapa"
              />
            ) : (
              <span
                className="block text-sm font-semibold truncate select-none [webkit-user-select:none]"
                style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
              >
                {entry.title}
              </span>
            )}
            <span
              className="block text-xs opacity-70 mt-0.5 select-none [webkit-user-select:none]"
              style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
            >
              {formatRelativeDate(entry.updatedAt)}
            </span>
          </span>
        </button>
        {!isRenaming && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-0"
          aria-label={`Eliminar ${entry.title}`}
          title="Eliminar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        )}
      </li>
    );
  };

  return (
    <div
      className={`mb-8 select-none [webkit-user-select:none] [webkit-touch-callout:none]${
        showTopDivider ? ' mt-5 pt-6 border-t border-neutral-200/80 dark:border-white/5' : ''
      }`}
      onSelectStart={preventNativeSelection}
    >
      <div className="mb-4 px-2 py-1">
        <span className="text-xs font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-400">
          Historial
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-500 px-1 py-2">
          Tus mapas generados aparecerán aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pinnedEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Pin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="text-xs font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
                  Fijados
                </span>
              </div>
              <ul className="flex flex-col gap-1 select-none [webkit-user-select:none]">{pinnedEntries.map(renderEntryItem)}</ul>
            </div>
          )}

          {recentEntries.length > 0 && (
            <div>
              {pinnedEntries.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1 mt-8">
                  <span className="text-xs font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
                    Recientes
                  </span>
                </div>
              )}
              <ul className="flex flex-col gap-1 select-none [webkit-user-select:none]">{recentEntries.map(renderEntryItem)}</ul>
            </div>
          )}
        </div>
      )}

      {actionMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="fixed inset-0 z-[120] cursor-default"
              onClick={() => setActionMenu(null)}
            />
            <div
              className="fixed z-[121] min-w-[10rem] rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden py-1"
              style={{
                top: actionMenu.top,
                left: actionMenu.left,
                width: actionMenu.width,
              }}
              role="menu"
            >
              {onRename && (
              <button
                type="button"
                role="menuitem"
                onClick={() => startRename(actionMenu.entry)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4 shrink-0 text-neutral-500" />
                Renombrar
              </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleTogglePinFromMenu}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
              >
                {actionMenu.entry.pinned ? (
                  <>
                    <PinOff className="w-4 h-4 shrink-0 text-neutral-500" />
                    Desfijar
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                    Fijar
                  </>
                )}
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
