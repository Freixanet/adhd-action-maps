import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform } from 'react-native';
import { runOnJS, useAnimatedKeyboard, useAnimatedReaction } from 'react-native-reanimated';

const DOCK_SETTLE_THRESHOLD = 1;

type ComposerKeyboardContextValue = {
  keyboardVisible: boolean;
  waitForComposerDockSettle: () => Promise<void>;
};

const ComposerKeyboardContext = createContext<ComposerKeyboardContextValue | null>(null);

export function ComposerKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboard = useAnimatedKeyboard();
  const keyboardHeightRef = useRef(0);
  const settleWaitersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flushSettleWaiters = useCallback(() => {
    const waiters = settleWaitersRef.current;
    settleWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);

  const syncKeyboardHeight = useCallback(
    (height: number) => {
      keyboardHeightRef.current = height;
      if (height <= DOCK_SETTLE_THRESHOLD) {
        flushSettleWaiters();
      }
    },
    [flushSettleWaiters]
  );

  useAnimatedReaction(
    () => keyboard.height.value,
    (height) => {
      runOnJS(syncKeyboardHeight)(height);
    },
    [syncKeyboardHeight]
  );

  const waitForComposerDockSettle = useCallback(() => {
    return new Promise<void>((resolve) => {
      const finish = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      };

      if (keyboardHeightRef.current <= DOCK_SETTLE_THRESHOLD) {
        finish();
        return;
      }

      settleWaitersRef.current.push(finish);
    });
  }, []);

  const value = useMemo(
    () => ({
      keyboardVisible,
      waitForComposerDockSettle,
    }),
    [keyboardVisible, waitForComposerDockSettle]
  );

  return (
    <ComposerKeyboardContext.Provider value={value}>{children}</ComposerKeyboardContext.Provider>
  );
}

export function useComposerKeyboard() {
  const context = useContext(ComposerKeyboardContext);
  if (!context) {
    throw new Error('useComposerKeyboard must be used within ComposerKeyboardProvider');
  }
  return context;
}
