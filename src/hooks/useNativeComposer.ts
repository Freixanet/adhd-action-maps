import { useCallback, useEffect, type RefObject } from 'react';

export type NativeComposerMetrics = {
  height: number;
  visible: boolean;
  keyboardVisible: boolean;
};

export type NativeComposerAttachment = {
  name?: string;
  previewUrl?: string;
  isImage?: boolean;
} | null;

export type NativeComposerLayout = {
  mainOffsetX: number;
  mainWidth?: number;
  sidebarOpen?: boolean;
  animated?: boolean;
  durationMs?: number;
  curve?: 'easeOut' | 'easeInOut' | 'linear';
};

type NativeComposerWindow = Window &
  typeof globalThis & {
    webkit?: {
      messageHandlers?: {
        nativeComposer?: {
          postMessage: (message: Record<string, unknown>) => void;
        };
      };
    };
  };

function postNativeComposerMessage(message: Record<string, unknown>) {
  (window as NativeComposerWindow).webkit?.messageHandlers?.nativeComposer?.postMessage({
    ...message,
  });
}

export function useNativeComposer({
  onSend,
  onAttach,
  onMenu,
  onChange,
  onMetricsChange,
  appState,
  visible,
  mainRef,
  attachment,
}: {
  onSend: (text: string) => void;
  onAttach: () => void;
  onMenu: () => void;
  onChange: (text: string) => void;
  onMetricsChange?: (metrics: NativeComposerMetrics) => void;
  appState: string;
  visible?: boolean;
  mainRef?: RefObject<HTMLElement | null>;
  attachment?: NativeComposerAttachment;
}) {
  const isNativeIOS = false;

  const setLayout = useCallback(
    (layout: NativeComposerLayout) => {
      if (!isNativeIOS) return;
      postNativeComposerMessage({
        action: 'setLayout',
        ...layout,
      });
    },
    [isNativeIOS]
  );

  useEffect(() => {
    if (!isNativeIOS) return;

    const handleSend = (event: Event) => onSend((event as CustomEvent<string>).detail);
    const handleAttach = () => onAttach();
    const handleMenu = () => onMenu();
    const handleChange = (event: Event) => onChange((event as CustomEvent<string>).detail);
    const handleMetrics = (event: Event) => {
      const detail = (event as CustomEvent<NativeComposerMetrics>).detail;
      if (detail) onMetricsChange?.(detail);
    };

    window.addEventListener('onComposerSend', handleSend);
    window.addEventListener('onComposerAttach', handleAttach);
    window.addEventListener('onComposerMenu', handleMenu);
    window.addEventListener('onComposerChange', handleChange);
    window.addEventListener('onComposerMetricsChange', handleMetrics);

    return () => {
      window.removeEventListener('onComposerSend', handleSend);
      window.removeEventListener('onComposerAttach', handleAttach);
      window.removeEventListener('onComposerMenu', handleMenu);
      window.removeEventListener('onComposerChange', handleChange);
      window.removeEventListener('onComposerMetricsChange', handleMetrics);
    };
  }, [isNativeIOS, onAttach, onChange, onMenu, onMetricsChange, onSend]);

  useEffect(() => {
    if (!isNativeIOS) return;
    postNativeComposerMessage({ action: visible !== false ? 'show' : 'hide' });

    return () => {
      postNativeComposerMessage({ action: 'hide' });
    };
  }, [isNativeIOS, visible]);

  useEffect(() => {
    if (!isNativeIOS) return;
    postNativeComposerMessage({ action: 'setLoading', loading: appState === 'loading' });
  }, [appState, isNativeIOS]);

  useEffect(() => {
    if (!isNativeIOS) return;
    postNativeComposerMessage({
      action: 'setAttachment',
      name: attachment?.name ?? null,
      previewUrl: attachment?.previewUrl ?? null,
      isImage: Boolean(attachment?.isImage),
    });
  }, [attachment?.isImage, attachment?.name, attachment?.previewUrl, isNativeIOS]);

  useEffect(() => {
    if (!isNativeIOS || !mainRef?.current) return;

    const sendLayout = () => {
      const rect = mainRef.current?.getBoundingClientRect();
      if (!rect) return;
      setLayout({
        mainOffsetX: rect.left,
        mainWidth: rect.width,
        sidebarOpen: rect.left > 0.5,
        animated: false,
      });
    };

    sendLayout();
    const frame = requestAnimationFrame(sendLayout);
    window.addEventListener('resize', sendLayout);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', sendLayout);
    };
  }, [isNativeIOS, mainRef, setLayout]);

  const clearText = useCallback(() => {
    postNativeComposerMessage({ action: 'clearText' });
  }, []);

  return { isNativeIOS, clearText, setLayout };
}
