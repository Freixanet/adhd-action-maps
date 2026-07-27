import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, BookOpen, Image as ImageIcon, X, MenuTwoLines } from '../icons';
import InlineGenerationThread from '../components/InlineGenerationThread';
import AttachMenu from '../components/AttachMenu';
import ComposerDismissScroll from '../components/ComposerDismissScroll';
import ComposerSendButton from '../components/ComposerSendButton';
import ComposerSurface from '../components/ComposerSurface';
import ComposerDock, { COMPOSER_DOCK_GAP, useComposerKeyboardLift } from '../components/ComposerDock';
import ContinueCard from '../components/ContinueCard';
import FloatingGlassButton from '../components/FloatingGlassButton';
import GlassSurface from '../components/GlassSurface';
import NativeGlassButton from '../components/NativeGlassButton';
import ModelChip from '../components/ModelChip';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassButton } from '../logic/nativeGlassButtons';
import SessionErrorBanner from '../components/SessionErrorBanner';
import {
  MAIN_CONTENT_GUTTER,
  SIDEBAR_EDGE_INSET,
  SIDEBAR_TOGGLE_BUTTON_SIZE,
} from '../components/sidebarLayout';
import { ComposerKeyboardProvider } from '../context/ComposerKeyboardContext';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';
import AppIcon from '../components/AppIcon';
import { KeyboardDismissBackdrop } from '../logic/keyboardDismiss';
import { registerComposerInputFocus } from '../logic/composerNativeMenuSession';
import { CONTINUE_CHIP_FADE_MS, buildContinueChipLabel } from '../logic/continueTransition';
import {
  COMPOSER_LINE_HEIGHT,
  COMPOSER_MAX_VIEWPORT_RATIO,
  COMPOSER_REST_INPUT_HEIGHT,
  formatPastedTextChipLabel,
} from '../logic/composerText';
import { formatInlineFileSize, truncateMiddleName } from '../logic/inlineUserBubble';
import { BG_BASE, BG_SURFACE } from '@shared/uiTokens';
import { agentLog } from '../logic/agentDebugLog';

const DEV = false;
const STATIC_PLACEHOLDER = 'Pega caos, recibe un Núcleo';
const HERO_FADE_MS = 150;

function dismissKeyboard() {
  Keyboard.dismiss();
}

const FIRST_USE_EXAMPLES = [
  'https://www.youtube.com/watch?v=example',
  'Pega un artículo sobre hábitos o atención…',
  'https://ejemplo.com/articulo-sobre-foco',
] as const;

export default function InputScreen() {
  const session = useAppSession();
  const { isDark } = useTheme();
  const { reduceTransparency } = useGlassAccessibility();
  const nativeGlassButtons = shouldUseNativeGlassButton(reduceTransparency);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxComposerInputHeight = Math.round(windowHeight * COMPOSER_MAX_VIEWPORT_RATIO);
  const composerDockBottom = Math.max(insets.bottom, COMPOSER_DOCK_GAP);
  const canSend = session.canSubmit && session.phase !== 'loading';
  const inlineActive = session.inlineGenerationStatus !== 'idle';
  const isAskTurn = session.inlineUserTurn?.kind === 'ask';
  const askComposerOpen =
    isAskTurn &&
    (session.inlineGenerationStatus === 'ready' || session.inlineGenerationStatus === 'error');
  const isGenerating =
    session.inlineGenerationStatus === 'generating' ||
    session.isStreamGenerating ||
    Boolean(session.collectionGenerationProgress) ||
    session.phase === 'loading';
  const composerDisabled = inlineActive && !askComposerOpen;
  // Keep the dock readable while generating so the stop control stays clear.
  const composerDimmed = inlineActive && !isGenerating;
  const navIconColor = isDark ? '#d4d4d4' : '#525252';
  const mutedIcon = isDark ? '#a3a3a3' : '#737373';
  const [composerHeight, setComposerHeight] = useState(176);
  const [composerFocused, setComposerFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [examplesFinished, setExamplesFinished] = useState(false);
  const composerInputRef = useRef<TextInput>(null);
  const continueChipRef = useRef<View>(null);
  const continueChipOpacity = useSharedValue(1);
  const heroOpacity = useSharedValue(1);
  const keyboardLiftStyle = useComposerKeyboardLift();

  const isFirstUse = !session.hasAnyNucleo;
  const showHero =
    !composerDisabled &&
    !session.canSubmit &&
    !composerFocused &&
    !session.uploadedFile &&
    !session.pastedText;

  const inputPlaceholder = DEV
    ? session.uploadedFile || session.hasAnyNucleo || examplesFinished
      ? session.composerPlaceholder
      : FIRST_USE_EXAMPLES[exampleIndex] ?? STATIC_PLACEHOLDER
    : STATIC_PLACEHOLDER;

  useEffect(() => {
    heroOpacity.value = withTiming(inlineActive ? 0 : 1, { duration: HERO_FADE_MS });
  }, [heroOpacity, inlineActive]);

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

  useEffect(() => {
    registerComposerInputFocus(() => {
      composerInputRef.current?.focus();
    });
    return () => {
      registerComposerInputFocus(null);
    };
  }, []);

  useEffect(() => {
    if (!DEV || !isFirstUse || examplesFinished || composerFocused || session.inputText.trim()) return;
    const timer = setInterval(() => {
      setExampleIndex((current) => {
        if (current >= FIRST_USE_EXAMPLES.length - 1) {
          setExamplesFinished(true);
          return current;
        }
        return current + 1;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [composerFocused, examplesFinished, isFirstUse, session.inputText]);

  useEffect(() => {
    if (session.continueTransition?.mode === 'expand') {
      continueChipOpacity.value = withTiming(0, { duration: CONTINUE_CHIP_FADE_MS });
      return;
    }
    continueChipOpacity.value = withTiming(1, { duration: CONTINUE_CHIP_FADE_MS });
  }, [continueChipOpacity, session.continueTransition?.mode]);

  const continueChipFadeStyle = useAnimatedStyle(() => ({
    opacity: continueChipOpacity.value,
  }));

  const heroFadeStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));

  const composerDisabledStyle = useAnimatedStyle(() => ({
    opacity: composerDimmed ? 0.5 : 1,
  }));

  const handleContinuePress = () => {
    const entry = session.continueEntry;
    if (!entry) return;
    continueChipRef.current?.measureInWindow((x, y, width, height) => {
      session.beginContinueTransition(
        entry.id,
        { x, y, width, height, borderRadius: 24 },
        buildContinueChipLabel(entry.title)
      );
    });
  };

  const showContinueCard = Boolean(session.continueEntry) && !composerDisabled && !isFirstUse;
  /**
   * Keyboard closed: center in the band from screen top (header included) down to
   * the composer top — not the full window, or the midpoint lands inside the dock.
   * Keyboard open + continue: center in the flex gap under the card.
   */
  const showScreenCenteredLogo =
    !inlineActive && !keyboardVisible && (showContinueCard || showHero);
  const showGapCenteredLogo = !inlineActive && keyboardVisible && showContinueCard;
  const screenCenteredLogoStyle = useMemo(
    () => [
      styles.screenCenteredLogo,
      { bottom: composerHeight + composerDockBottom },
    ],
    [composerDockBottom, composerHeight]
  );

  const handleBrandLongPress = () => {
    if (!__DEV__) return;
    if (session.devHistoryHidden) {
      Alert.alert('Restaurar historial (dev)', '¿Recuperar tu historial guardado?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: () => session.devRestoreHistory?.(),
        },
      ]);
      return;
    }
    if (!session.devHideHistory) return;
    Alert.alert(
      'Ocultar historial (dev)',
      'La app parecerá vacía, pero tu historial queda guardado en el dispositivo. Mantén pulsado nucleo de nuevo para restaurar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          onPress: () => session.devHideHistory?.(),
        },
      ]
    );
  };

  const brandMark = (
    <Pressable
      onLongPress={handleBrandLongPress}
      delayLongPress={700}
      accessibilityRole="button"
      accessibilityLabel="nucleo"
      className="items-center"
    >
      <AppIcon size={88} color={BG_SURFACE} dotColor="#1C1E24" />
    </Pressable>
  );

  const handleCancelAutoOpen = () => {
    if (session.inlineGenerationStatus === 'ready') {
      session.cancelInlineAutoOpen();
    }
  };

  const menusBlockScroll = session.historyOpen;

  // #region agent log
  agentLog('A', 'InputScreen.tsx:render', 'InputScreen render', {
    composerDisabled,
    canSend,
    phase: session.phase,
    inlineStatus: session.inlineGenerationStatus,
    showScreenCenteredLogo:
      !inlineActive && !keyboardVisible && (Boolean(session.continueEntry) && !composerDisabled && !isFirstUse || showHero),
  });
  // #endregion

  return (
    <ComposerKeyboardProvider>
      {/*
        Uniwind does not patch SafeAreaView from react-native-safe-area-context,
        so className flex-1 is a no-op here. Without an explicit style flex:1 the
        screen collapses and the absolute composer docks to the top of the phone.
      */}
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: BG_BASE }}
        className="flex-1 bg-base"
      >
        <View
          className="flex-1 px-3"
          style={{ flex: 1, position: 'relative' }}
          onTouchStart={handleCancelAutoOpen}
        >
          {inlineActive ? null : (
            <View
              className="flex-row items-center justify-between pt-2.5 pb-4"
              style={{
                marginHorizontal: -MAIN_CONTENT_GUTTER,
                paddingLeft: MAIN_CONTENT_GUTTER,
                paddingRight: SIDEBAR_EDGE_INSET,
              }}
            >
              <FloatingGlassButton
                onPress={() => session.toggleHistoryDrawer()}
                accessibilityLabel={session.historyOpen ? 'Cerrar navegacion' : 'Abrir navegacion'}
                shape="circle"
                size={SIDEBAR_TOGGLE_BUTTON_SIZE}
              >
                <MenuTwoLines size={20} color={navIconColor} />
              </FloatingGlassButton>
            </View>
          )}

          {session.inlineGenerationStatus === 'idle' ? <SessionErrorBanner /> : null}

          <Animated.View style={[{ flex: 1 }, keyboardLiftStyle]}>
            <ScrollView
              className="flex-1 bg-transparent"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="always"
              scrollEnabled={!menusBlockScroll}
              alwaysBounceVertical={Platform.OS === 'ios' && keyboardVisible}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-1"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: inlineActive ? 'flex-start' : undefined,
                // Header is hidden while generating — keep the message below the status area.
                paddingTop: inlineActive ? 128 : 0,
                paddingBottom: composerHeight + 16,
              }}
            >
              {inlineActive ? (
                <View className="w-full flex-1">
                  <InlineGenerationThread />
                </View>
              ) : showContinueCard && session.continueEntry ? (
              <View className="w-full flex-1 pt-8 pb-2 px-1">
                <Animated.View style={continueChipFadeStyle} className="w-full mb-2">
                  <ContinueCard
                    ref={continueChipRef}
                    entry={session.continueEntry}
                    onPress={handleContinuePress}
                    onDismiss={session.dismissContinueChip}
                  />
                </Animated.View>
                {showGapCenteredLogo ? (
                  <KeyboardDismissBackdrop className="flex-1 w-full items-center justify-center">
                    {brandMark}
                  </KeyboardDismissBackdrop>
                ) : (
                  <KeyboardDismissBackdrop className="flex-1 w-full" />
                )}
              </View>
              ) : (
              <KeyboardDismissBackdrop className="w-full flex-1" />
              )}
            </ScrollView>
          </Animated.View>

          {showScreenCenteredLogo ? (
            <View
              pointerEvents="none"
              style={screenCenteredLogoStyle}
              onLayout={() => {
                // #region agent log
                agentLog('B', 'InputScreen.tsx:logoOverlay', 'logo overlay laid out', {
                  composerHeight,
                  composerDockBottom,
                  showScreenCenteredLogo: true,
                });
                // #endregion
              }}
            >
              <Animated.View style={heroFadeStyle} className="items-center px-2">
                <View pointerEvents="auto" className="items-center">
                  {brandMark}
                  {showHero && !showContinueCard ? (
                    <>
                      <Text className="mt-6 text-center text-[15px] leading-6 text-secondary">
                        Separa lo importante del ruido.
                      </Text>
                      {isFirstUse ? (
                        nativeGlassButtons ? (
                          <NativeGlassButton
                            onPress={session.handleOpenDemoNucleo}
                            accessibilityLabel="Ver un ejemplo"
                            cornerRadius={24}
                            style={styles.demoCtaNative}
                          >
                            <Text className="text-[15px] font-normal text-body">
                              Ver un ejemplo
                            </Text>
                          </NativeGlassButton>
                        ) : (
                          <Pressable
                            onPress={session.handleOpenDemoNucleo}
                            accessibilityRole="button"
                            accessibilityLabel="Ver un ejemplo"
                            className="mt-6"
                          >
                            {({ pressed }) => (
                              <GlassSurface
                                liquid
                                variant="composer"
                                borderRadius={24}
                                liquidBorder="perimeter"
                                overlayClassName={pressed ? 'bg-accent/8' : undefined}
                              >
                                <View className="px-4 py-2.5">
                                  <Text className="text-[15px] font-normal text-body">
                                    Ver un ejemplo
                                  </Text>
                                </View>
                              </GlassSurface>
                            )}
                          </Pressable>
                        )
                      ) : null}
                    </>
                  ) : null}
                </View>
              </Animated.View>
            </View>
          ) : null}

          <ComposerDock onHeightChange={setComposerHeight}>
            <ComposerDismissScroll>
              <Animated.View style={composerDisabledStyle}>
                <ComposerSurface focused={composerFocused && !composerDisabled} inputRef={composerInputRef}>
                  <View pointerEvents={composerDisabled ? 'none' : 'auto'}>
                    {session.uploadedFile ? (
                      <View className="px-5 pt-4 pb-1">
                        {session.uploadedFile.isImage && session.uploadedFile.previewUri ? (
                          <View className="relative self-start">
                            <Image
                              source={{ uri: session.uploadedFile.previewUri }}
                              accessibilityLabel={session.uploadedFile.name}
                              className="w-16 h-16 rounded-xl border border-white/10"
                            />
                            <Pressable
                              onPress={session.removeUploadedFile}
                              accessibilityLabel="Quitar archivo"
                              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface-2 items-center justify-center"
                            >
                              <X size={12} color="#fff" />
                            </Pressable>
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2 self-start max-w-full px-3 py-1.5 rounded-full bg-white/10">
                            {session.uploadedFile.isEpub ? (
                              <BookOpen size={16} color={mutedIcon} />
                            ) : session.uploadedFile.isImage ? (
                              <ImageIcon size={16} color={mutedIcon} />
                            ) : (
                              <File size={16} color={mutedIcon} />
                            )}
                            <Text className="text-sm shrink text-primary" numberOfLines={1}>
                              {truncateMiddleName(session.uploadedFile.name, 22)}
                              {formatInlineFileSize(session.uploadedFile.size)
                                ? ` · ${formatInlineFileSize(session.uploadedFile.size)}`
                                : ''}
                            </Text>
                            <Pressable
                              onPress={session.removeUploadedFile}
                              accessibilityLabel="Quitar archivo"
                              className="p-0.5 rounded-full"
                            >
                              <X size={14} color={mutedIcon} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ) : null}

                    {session.pastedText ? (
                      <View className="px-5 pt-4 pb-1">
                        <View className="flex-row items-center gap-2 self-start max-w-full px-3 py-1.5 rounded-full bg-white/10">
                          <File size={16} color={mutedIcon} />
                          <Text className="text-sm shrink text-primary" numberOfLines={1}>
                            {formatPastedTextChipLabel(session.pastedText)}
                          </Text>
                          <Pressable onPress={session.removePastedText} className="p-0.5 rounded-full">
                            <X size={14} color={mutedIcon} />
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {!session.hideTextInput ? (
                      <TextInput
                        key={session.pastedText ? 'composer-collapsed' : 'composer-input'}
                        ref={composerInputRef}
                        value={session.inputText}
                        onChangeText={session.handleComposerTextChange}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => {
                          setComposerFocused(false);
                          session.persistComposerDraft();
                        }}
                        editable={!composerDisabled}
                        placeholder={inputPlaceholder}
                        placeholderTextColor={isDark ? '#9CA0AB' : '#737373'}
                        multiline
                        textAlignVertical="top"
                        style={{
                          minHeight: COMPOSER_REST_INPUT_HEIGHT,
                          maxHeight: maxComposerInputHeight,
                          paddingHorizontal: 20,
                          paddingVertical: 16,
                          fontSize: 16,
                          lineHeight: COMPOSER_LINE_HEIGHT,
                          color: isDark ? '#FAFAFA' : '#171717',
                        }}
                      />
                    ) : null}

                    {/* Toolbar stays inside the glass chrome but above the native GlassView
                        hit layer (LiquidGlassSurface is pointerEvents=none). */}
                    <View
                      pointerEvents={composerDisabled ? 'none' : 'auto'}
                      style={styles.composerToolbar}
                      onTouchStart={() => {
                        // #region agent log
                        agentLog('B', 'InputScreen.tsx:toolbar', 'toolbar onTouchStart', {
                          composerDisabled,
                          canSend,
                          phase: session.phase,
                          inlineStatus: session.inlineGenerationStatus,
                        });
                        // #endregion
                      }}
                    >
                      <View className="flex-row items-center gap-2 shrink">
                        <AttachMenu
                          onPickCamera={() => void session.handlePickCamera()}
                          onPickImage={() => void session.handlePickImage()}
                          onPickFile={() => void session.handlePickFile()}
                          onPreviewGeneration={
                            __DEV__ ? () => session.previewInlineGeneration?.() : undefined
                          }
                          onPreviewLoadingScreen={
                            __DEV__ ? () => session.previewLoadingScreen?.() : undefined
                          }
                          onPreviewNucleo={
                            __DEV__ ? () => session.previewNucleo?.() : undefined
                          }
                          disabled={session.phase === 'loading' || composerDisabled}
                          darkSurface={isDark}
                        />
                        {DEV ? (
                          <ModelChip
                            value={session.depthPreference}
                            onChange={session.setDepthPreference}
                            onOpenPaywall={session.openPaywall}
                            disabled={session.phase === 'loading' || composerDisabled}
                          />
                        ) : null}
                      </View>
                      <ComposerSendButton
                        mode={isGenerating ? 'stop' : 'send'}
                        onPress={() => {
                          // #region agent log
                          agentLog('E', 'InputScreen.tsx:send', 'send onPress fired', {
                            canSend,
                            isGenerating,
                          });
                          // #endregion
                          Keyboard.dismiss();
                          if (isGenerating) {
                            session.handleCancelLoading();
                            return;
                          }
                          void session.handleComposerSubmit();
                        }}
                        disabled={!canSend}
                      />
                    </View>
                  </View>
                </ComposerSurface>
              </Animated.View>
            </ComposerDismissScroll>
          </ComposerDock>
        </View>
      </SafeAreaView>
    </ComposerKeyboardProvider>
  );
}

const styles = StyleSheet.create({
  /** Native button sizes to content; mirrors the JS px-4 py-2.5 pill. */
  demoCtaNative: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  screenCenteredLogo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  composerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 6,
    gap: 8,
    zIndex: 30,
  },
});
