import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, MenuTwoLines, SquarePen, File, FileText, BookOpen, Video } from '../icons';
import InlineGenerationThread from '../components/InlineGenerationThread';
import { preloadThinkingOrbHtml } from '../components/ThinkingOrbWebView';
import AttachMenu from '../components/AttachMenu';
import HyperspacePreview from '../components/HyperspaceView';
import ComposerDismissScroll from '../components/ComposerDismissScroll';
import ComposerSendButton from '../components/ComposerSendButton';
import ComposerSurface from '../components/ComposerSurface';
import ComposerSwipeDismiss from '../components/ComposerSwipeDismiss';
import ComposerDock, {
  COMPOSER_DOCK_GAP,
  useComposerKeyboardInset,
  useComposerKeyboardInputHeight,
  useComposerKeyboardLift,
  useComposerKeyboardTextFrameStyle,
} from '../components/ComposerDock';
import FloatingGlassButton from '../components/FloatingGlassButton';
import HomeSurfaceSegment from '../components/HomeSurfaceSegment';
import type { HomeSurface } from '@shared/homeSurfaceModel';
import JumpBackInSection from '../components/JumpBackInSection';
import GlassSurface from '../components/GlassSurface';
import NativeGlassButton from '../components/NativeGlassButton';
import ModelChip from '../components/ModelChip';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassButton, NATIVE_MENU_TWO_LINES } from '../logic/nativeGlassButtons';
import SessionErrorBanner from '../components/SessionErrorBanner';
import {
  MAIN_CONTENT_GUTTER,
  SIDEBAR_EDGE_INSET,
  SIDEBAR_TOGGLE_BUTTON_SIZE,
} from '../components/sidebarLayout';
import { ComposerKeyboardProvider } from '../context/ComposerKeyboardContext';
import { useHomeSheetGestureLock } from '../context/HomeSheetGestureLock';
import { useAppSession } from '../context/AppSessionContext';
import { useTheme } from '../context/ThemeContext';
import { KeyboardDismissBackdrop } from '../logic/keyboardDismiss';
import {
  markComposerNativeMenuEnded,
  registerComposerInputFocus,
  restoreComposerInputFocus,
  shouldSuppressKeyboardDismissForComposerMenu,
} from '../logic/composerNativeMenuSession';
import {
  COMPOSER_CONTROL_SIZE,
  COMPOSER_FOCUSED_INPUT_HEIGHT,
  COMPOSER_LINE_HEIGHT,
  COMPOSER_PLUS_ICON_SIZE,
  COMPOSER_REST_INPUT_HEIGHT,
  COMPOSER_REST_TEXT_PAD_BOTTOM,
  COMPOSER_REST_TEXT_PAD_TOP,
  formatPastedTextChipLabel,
} from '../logic/composerText';
import { resolveAttachmentImagePreviewUri, type UploadedFile } from '../logic/attachments';
import { space, type } from '@shared/design-tokens';
import { useTypography } from '../context/TypographyContext';
import { hapticCommit } from '../logic/haptics';
const DEV = false;
const HERO_FADE_MS = 150;
/** Same offset as the old header `pt-2.5` — toggle floats, no header bar. */
const SIDEBAR_TOGGLE_TOP = 10; // design-token-ignore: matches prior header pt-2.5
/** Extra space under the Chat/Núcleo bar before the greeting (was 56). */
const HOME_REST_BELOW_CHROME = space.stack.xl * 3 + space.stack.lg;
/** Left of the plus inside the 38pt hit target, plus icon inner padding. */
const COMPOSER_PLUS_GLYPH_INSET =
  (COMPOSER_CONTROL_SIZE - COMPOSER_PLUS_ICON_SIZE) / 2 + space.stack.xs;
const COMPOSER_TEXT_BESIDE_CONTROL = COMPOSER_CONTROL_SIZE + space.stack.xs;
/** Square image chip — large enough that radius.composer does not read as a circle. */
const ATTACHMENT_IMAGE_SIZE = 112;
const ATTACHMENT_FILE_ICON_SIZE = 32; // design-token-ignore: sits in the 112pt file chip

function ComposerFileKindIcon({ file, color }: { file: UploadedFile; color: string }) {
  if (file.isEpub) return <BookOpen size={ATTACHMENT_FILE_ICON_SIZE} color={color} />;
  if (file.isVideo) return <Video size={ATTACHMENT_FILE_ICON_SIZE} color={color} />;
  if (file.isPdf) return <File size={ATTACHMENT_FILE_ICON_SIZE} color={color} />;
  return <FileText size={ATTACHMENT_FILE_ICON_SIZE} color={color} />;
}

function dismissKeyboard() {
  Keyboard.dismiss();
}

export default function InputScreen() {
  const session = useAppSession();
  const { isDark, colors } = useTheme();
  const { font } = useTypography();
  const { reduceTransparency, reduceMotion } = useGlassAccessibility();
  const nativeGlassButtons = shouldUseNativeGlassButton(reduceTransparency);
  const canSend = session.canSubmit && session.phase !== 'loading';
  const askThreadOpen =
    session.inlineUserTurn?.kind === 'ask' ||
    (session.inlineAskPriorTurns?.length ?? 0) > 0 ||
    Boolean(session.activeChatId);
  const inlineActive = session.inlineGenerationStatus !== 'idle' || askThreadOpen;
  const askComposerOpen =
    askThreadOpen &&
    (session.inlineGenerationStatus === 'ready' ||
      session.inlineGenerationStatus === 'error' ||
      session.inlineGenerationStatus === 'cancelled' ||
      session.inlineGenerationStatus === 'idle');
  const isGenerating =
    session.inlineGenerationStatus === 'generating' ||
    session.inlineGenerationStatus === 'partial' ||
    session.isStreamGenerating ||
    Boolean(session.collectionGenerationProgress) ||
    session.phase === 'loading';
  const composerDisabled =
    inlineActive && !askComposerOpen && session.inlineGenerationStatus !== 'cancelled';
  // Núcleo ready: dim the dock so “Abrir Núcleo” stays the action. Ask chats stay live.
  const composerDimmed =
    inlineActive &&
    !isGenerating &&
    !askComposerOpen &&
    session.inlineGenerationStatus !== 'cancelled';
  const navIconColor = colors.icon.primary;
  const mutedIcon = colors.icon.muted;
  const [composerHeight, setComposerHeight] = useState(64);
  const [composerFocused, setComposerFocused] = useState(false);
  const [hyperspacePreviewOpen, setHyperspacePreviewOpen] = useState(false);
  const composerInputRef = useRef<TextInput>(null);
  const heroOpacity = useSharedValue(1);
  const keyboardLiftStyle = useComposerKeyboardLift(COMPOSER_DOCK_GAP, composerFocused);
  const composerKeyboardInsetStyle = useComposerKeyboardInset(space.stack.lg, composerFocused);
  const composerInputGrowStyle = useComposerKeyboardInputHeight(
    COMPOSER_REST_INPUT_HEIGHT,
    COMPOSER_FOCUSED_INPUT_HEIGHT,
    composerFocused
  );
  const composerTextFrameStyle = useComposerKeyboardTextFrameStyle(
    {
      paddingLeft: COMPOSER_TEXT_BESIDE_CONTROL,
      paddingRight: COMPOSER_TEXT_BESIDE_CONTROL,
      paddingTop: COMPOSER_REST_TEXT_PAD_TOP,
      paddingBottom: COMPOSER_REST_TEXT_PAD_BOTTOM,
    },
    {
      paddingLeft: COMPOSER_PLUS_GLYPH_INSET,
      paddingRight: space.stack.sm,
      paddingTop: space.stack.sm,
      paddingBottom: COMPOSER_CONTROL_SIZE,
    },
    composerFocused
  );
  const scrollBottomPad = composerHeight + 16;

  const isFirstUse = !session.hasAnyNucleo;
  const showHero = !inlineActive;

  useEffect(() => {
    heroOpacity.value = withTiming(inlineActive || composerFocused ? 0 : 1, {
      duration: reduceMotion ? 0 : HERO_FADE_MS,
    });
  }, [composerFocused, heroOpacity, inlineActive, reduceMotion]);

  useEffect(() => {
    registerComposerInputFocus(() => {
      composerInputRef.current?.focus();
    });
    return () => {
      registerComposerInputFocus(null);
    };
  }, []);

  useEffect(() => {
    preloadThinkingOrbHtml();
  }, []);

  const heroFadeStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));

  const composerDisabledStyle = useAnimatedStyle(() => ({
    opacity: composerDimmed ? 0.5 : 1,
  }));

  /** Home rest: greeting + jump-back; stays under the composer dock. */
  const showHomeRestContent = !inlineActive;
  const homeFirstName =
    session.cloudUserDisplayName?.trim().split(/\s+/)[0] || null;
  const showJumpBackIn = showHomeRestContent;

  const handleSelectHistory = session.handleSelectHistory;
  const handleSelectJumpBack = useCallback(
    (id: string) => {
      handleSelectHistory(id);
    },
    [handleSelectHistory]
  );

  const handleHomeSurfaceChange = useCallback(
    (next: HomeSurface) => {
      if (next === session.homeSurface) return;
      if (inlineActive) session.handleNewMap();
      session.setHomeSurface(next);
    },
    [inlineActive, session]
  );

  const dismissComposerFromOutside = useCallback(() => {
    if (shouldSuppressKeyboardDismissForComposerMenu()) {
      markComposerNativeMenuEnded();
      restoreComposerInputFocus();
      return;
    }
    Keyboard.dismiss();
    composerInputRef.current?.blur();
    setComposerFocused(false);
  }, []);

  const attachMenuProps = {
    onPickCamera: () => void session.handlePickCamera(),
    onPickImage: () => void session.handlePickImage(),
    onPickFile: () => void session.handlePickFile(),
    onLoadQaMultipagePdf:
      session.devToolsEnabled || __DEV__
        ? (intent: Parameters<NonNullable<typeof session.handleLoadQaMultipagePdf>>[0]) =>
            void session.handleLoadQaMultipagePdf(intent)
        : undefined,
    onPreviewChatThinking:
      session.devToolsEnabled || __DEV__ ? () => session.previewChatThinking?.() : undefined,
    onPreviewHyperspace:
      session.devToolsEnabled || __DEV__ ? () => setHyperspacePreviewOpen(true) : undefined,
    onEditorialDemo:
      session.devToolsEnabled || __DEV__
        ? (fixtureId: 'procrastination' | 'attention') => session.openEditorialDemo(fixtureId)
        : undefined,
    modelPreference: session.modelPreference,
    onSelectModel:
      session.devToolsEnabled || __DEV__ ? session.setModelPreference : undefined,
    disabled: session.phase === 'loading' || composerDisabled,
    darkSurface: isDark,
  } as const;

  const handleCancelAutoOpen = () => {
    if (session.inlineGenerationStatus === 'ready') {
      session.cancelInlineAutoOpen();
    }
  };

  const sheetGestureLock = useHomeSheetGestureLock();
  const menusBlockScroll = session.historyOpen || Boolean(sheetGestureLock?.locked);

  return (
    <ComposerKeyboardProvider>
      {/*
        Uniwind does not patch SafeAreaView from react-native-safe-area-context,
        so className flex-1 is a no-op here. Without an explicit style flex:1 the
        screen collapses and the absolute composer docks to the top of the phone.
      */}
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.background.canvas }}
        className="flex-1 bg-base"
      >
        <View
          className="flex-1"
          style={{ flex: 1, position: 'relative' }}
          onTouchStart={handleCancelAutoOpen}
        >
          <Animated.View style={[{ flex: 1 }, keyboardLiftStyle]}>
            <ScrollView
              className="flex-1 bg-transparent"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="always"
              scrollEnabled={!menusBlockScroll}
              directionalLockEnabled
              alwaysBounceVertical={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: inlineActive
                  ? 'flex-start'
                  : showHomeRestContent || showJumpBackIn || showHero
                    ? 'flex-start'
                    : 'center',
                paddingTop:
                  SIDEBAR_TOGGLE_TOP +
                  SIDEBAR_TOGGLE_BUTTON_SIZE +
                  space.stack.md +
                  (inlineActive ? 12 : showHomeRestContent ? HOME_REST_BELOW_CHROME : 0),
                paddingBottom: scrollBottomPad,
              }}
            >
              {session.inlineGenerationStatus === 'idle' ? (
                <View style={{ paddingHorizontal: MAIN_CONTENT_GUTTER }}>
                  <SessionErrorBanner />
                </View>
              ) : null}
              {inlineActive ? (
                <KeyboardDismissBackdrop
                  className="w-full flex-1"
                  onPress={dismissComposerFromOutside}
                >
                  <View
                    className="w-full flex-1"
                    style={{ paddingHorizontal: SIDEBAR_EDGE_INSET }}
                    pointerEvents={composerFocused ? 'none' : 'auto'}
                  >
                    <InlineGenerationThread />
                  </View>
                </KeyboardDismissBackdrop>
              ) : (
                <KeyboardDismissBackdrop
                  className="w-full flex-1"
                  onPress={dismissComposerFromOutside}
                >
                  <Animated.View
                    style={[heroFadeStyle, { width: '100%' }]}
                    pointerEvents={composerFocused ? 'none' : 'auto'}
                  >
                    <View
                      style={{ paddingHorizontal: SIDEBAR_EDGE_INSET }}
                      className="items-start pb-1"
                    >
                      {/*
                        Style-only colors (same pattern as JumpBack heading).
                        Uniwind text-* classes can stay on the light palette
                        while the canvas is dark — ink then vanishes.
                      */}
                      <Text
                        style={[
                          styles.homeGreeting,
                          { color: colors.text.primary, fontFamily: font.family },
                        ]}
                      >
                        <Text
                          style={[
                            styles.homeGreetingItalic,
                            { color: colors.text.primary, fontFamily: font.italicFamily },
                          ]}
                        >
                          Sapere aude
                        </Text>
                        {homeFirstName ? (
                          <>
                            {', '}
                            <Text
                              style={[styles.homeGreetingName, { color: colors.text.primary, fontFamily: font.family }]}
                            >
                              {homeFirstName}
                            </Text>
                          </>
                        ) : null}
                      </Text>
                    </View>
                    {showHero ? (
                      <View
                        style={{ paddingHorizontal: SIDEBAR_EDGE_INSET }}
                        className="items-start"
                      >
                        <Text
                          style={[
                            styles.homeTagline,
                            { color: colors.text.body, fontFamily: font.family },
                          ]}
                        >
                          Separa lo importante del ruido
                        </Text>
                        {isFirstUse ? (
                          nativeGlassButtons ? (
                            <NativeGlassButton
                              onPress={session.handleOpenDemoNucleo}
                              accessibilityLabel="Ver un ejemplo"
                              title="Ver un ejemplo"
                              cornerRadius={24}
                              style={styles.demoCtaNative}
                            />
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
                                    <Text
                                      style={{
                                        fontSize: type.body.fontSize,
                                        lineHeight: type.body.lineHeight,
                                        fontFamily: font.family,
                                        color: colors.text.body,
                                      }}
                                    >
                                      Ver un ejemplo
                                    </Text>
                                  </View>
                                </GlassSurface>
                              )}
                            </Pressable>
                          )
                        ) : null}
                      </View>
                    ) : null}
                    {showJumpBackIn ? (
                      <JumpBackInSection
                        onSelect={handleSelectJumpBack}
                        spacing="lead"
                      />
                    ) : null}
                  </Animated.View>
                </KeyboardDismissBackdrop>
              )}
            </ScrollView>
          </Animated.View>

          {composerFocused ? (
            <Pressable
              accessible={false}
              onPress={dismissComposerFromOutside}
              style={styles.composerDismissOverlay}
            />
          ) : null}

          <ComposerDock hold={composerFocused} onHeightChange={setComposerHeight}>
            <ComposerDismissScroll>
              <ComposerSwipeDismiss
                enabled={composerFocused && !composerDisabled}
                onDismiss={dismissComposerFromOutside}
                style={[composerDisabledStyle, composerKeyboardInsetStyle]}
              >
                <ComposerSurface focused={composerFocused && !composerDisabled} inputRef={composerInputRef}>
                  <View pointerEvents={composerDisabled ? 'box-none' : 'auto'}>
                    {session.uploadedFile ? (
                      <View style={styles.composerImageSlot}>
                        <View style={styles.composerImagePreviewWrap}>
                          {resolveAttachmentImagePreviewUri(session.uploadedFile) ? (
                            <Image
                              source={{
                                uri: resolveAttachmentImagePreviewUri(session.uploadedFile)!,
                              }}
                              accessibilityLabel={session.uploadedFile.name}
                              resizeMode="cover"
                              style={[
                                styles.composerImagePreview,
                                { borderColor: colors.background.whiteFade10 },
                              ]}
                            />
                          ) : (
                            <View
                              accessibilityLabel={session.uploadedFile.name}
                              style={[
                                styles.composerImagePreview,
                                styles.composerFilePreview,
                                {
                                  borderColor: colors.background.whiteFade10,
                                  backgroundColor: colors.background.surface,
                                },
                              ]}
                            >
                              <ComposerFileKindIcon
                                file={session.uploadedFile}
                                color={colors.icon.primary}
                              />
                              <Text
                                numberOfLines={2}
                                style={[
                                  styles.composerFileName,
                                  { color: colors.text.primary, fontFamily: font.family },
                                ]}
                              >
                                {session.uploadedFile.name}
                              </Text>
                            </View>
                          )}
                          <Pressable
                            onPress={session.removeUploadedFile}
                            accessibilityLabel="Quitar archivo"
                            style={styles.composerImageRemove}
                            className="w-6 h-6 rounded-full bg-surface-2 items-center justify-center"
                          >
                            <X size={12} color={colors.text.primary} />
                          </Pressable>
                        </View>
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

                    {/* + / send stay on the rest row. Expanded text starts at the + glyph’s x, on the top line. */}
                    <View pointerEvents="box-none" style={styles.composerRow}>
                      <Animated.View
                        pointerEvents="box-none"
                        style={[styles.composerInputHost, composerInputGrowStyle]}
                      >
                        <Pressable
                          accessibilityRole="none"
                          onPressIn={() => composerInputRef.current?.focus()}
                          pointerEvents={composerDisabled || composerFocused ? 'none' : 'auto'}
                          style={styles.composerFocusHit}
                        />
                        {!session.hideTextInput ? (
                          <Animated.View
                            pointerEvents={composerDisabled ? 'none' : 'box-none'}
                            style={[styles.composerTextFrame, composerTextFrameStyle]}
                          >
                            <TextInput
                              key={session.pastedText ? 'composer-collapsed' : 'composer-input'}
                              ref={composerInputRef}
                              value={session.inputText}
                              onChangeText={session.handleComposerTextChange}
                              onFocus={() => {
                                setComposerFocused(true);
                              }}
                              onBlur={() => {
                                // iOS can resign first responder for a beat while typing.
                                requestAnimationFrame(() => {
                                  if (composerInputRef.current?.isFocused()) {
                                    setComposerFocused(true);
                                    return;
                                  }
                                  setComposerFocused(false);
                                  session.persistComposerDraft();
                                });
                              }}
                              editable={!composerDisabled}
                              placeholder={session.composerPlaceholder}
                              placeholderTextColor={colors.text.secondary}
                              multiline
                              scrollEnabled={composerFocused}
                              showSoftInputOnFocus
                              textAlignVertical="top"
                              style={[
                                styles.composerInput,
                                {
                                  fontSize: type.input.fontSize,
                                  lineHeight: COMPOSER_LINE_HEIGHT,
                                  fontFamily: font.family,
                                  color: colors.text.primary,
                                  backgroundColor: 'transparent',
                                },
                              ]}
                            />
                          </Animated.View>
                        ) : (
                          <View pointerEvents="none" style={styles.composerInputSpacer} />
                        )}
                        <View
                          pointerEvents={composerDisabled ? 'none' : 'auto'}
                          style={styles.composerPlus}
                        >
                          <AttachMenu {...attachMenuProps} />
                          {DEV ? (
                            <ModelChip
                              value={session.depthPreference}
                              onChange={session.setDepthPreference}
                              onOpenPaywall={session.openPaywall}
                              disabled={session.phase === 'loading' || composerDisabled}
                            />
                          ) : null}
                        </View>
                        <View pointerEvents="auto" style={styles.composerSend}>
                          <ComposerSendButton
                            mode={isGenerating ? 'stop' : 'send'}
                            onPress={() => {
                              Keyboard.dismiss();
                              if (isGenerating) {
                                hapticCommit();
                                session.handleCancelLoading();
                                return;
                              }
                              hapticCommit();
                              void session.handleComposerSubmit();
                            }}
                            disabled={!canSend}
                          />
                        </View>
                      </Animated.View>
                    </View>
                  </View>
                </ComposerSurface>
              </ComposerSwipeDismiss>
            </ComposerDismissScroll>
          </ComposerDock>

          <View pointerEvents="box-none" style={styles.homeTopBar}>
            <FloatingGlassButton
              onPress={() => session.toggleHistoryDrawer()}
              accessibilityLabel={session.historyOpen ? 'Cerrar navegacion' : 'Abrir navegacion'}
              shape="circle"
              size={SIDEBAR_TOGGLE_BUTTON_SIZE}
              systemImage={NATIVE_MENU_TWO_LINES}
              symbolPointSize={20}
            >
              <MenuTwoLines size={20} color={navIconColor} />
            </FloatingGlassButton>
            <View pointerEvents="box-none" style={styles.homeSurfaceCenter}>
              <HomeSurfaceSegment
                value={session.homeSurface}
                onChange={handleHomeSurfaceChange}
                disabled={isGenerating}
              />
            </View>
            <View pointerEvents="box-none" style={styles.homeTopBarSide}>
              {askThreadOpen ? (
                <FloatingGlassButton
                  onPress={() => session.handleNewMap()}
                  accessibilityLabel="Nuevo chat"
                  shape="circle"
                  size={SIDEBAR_TOGGLE_BUTTON_SIZE}
                  systemImage="square.and.pencil"
                  symbolPointSize={17}
                >
                  <SquarePen size={20} color={navIconColor} />
                </FloatingGlassButton>
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>
      <HyperspacePreview
        visible={hyperspacePreviewOpen}
        onClose={() => setHyperspacePreviewOpen(false)}
      />
    </ComposerKeyboardProvider>
  );
}

const styles = StyleSheet.create({
  homeTopBar: {
    position: 'absolute',
    top: SIDEBAR_TOGGLE_TOP, // design-token-ignore: matches prior header pt-2.5
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDEBAR_EDGE_INSET,
    height: SIDEBAR_TOGGLE_BUTTON_SIZE,
    overflow: 'visible',
  },
  homeTopBarSide: {
    width: SIDEBAR_TOGGLE_BUTTON_SIZE,
    height: SIDEBAR_TOGGLE_BUTTON_SIZE,
  },
  homeSurfaceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  composerDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  homeGreeting: {
    textAlign: 'left',
    fontSize: type.titleExtrabold.fontSize,
    lineHeight: type.titleExtrabold.lineHeight,
    fontWeight: type.body.fontWeight,
    letterSpacing: type.titleExtrabold.letterSpacing,
  },
  homeGreetingItalic: {
    fontStyle: 'italic',
    fontWeight: type.body.fontWeight,
  },
  homeGreetingName: {
    fontWeight: type.continueTitle.fontWeight,
  },
  homeTagline: {
    textAlign: 'left',
    fontSize: type.sectionTitle.fontSize,
    lineHeight: type.sectionTitle.lineHeight,
    fontWeight: type.body.fontWeight,
    letterSpacing: type.sectionTitle.letterSpacing,
  },
  /** Native button sizes to content; mirrors the JS px-4 py-2.5 pill. */
  demoCtaNative: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  composerImageSlot: {
    paddingHorizontal: space.stack.sm,
    paddingTop: space.stack.sm,
    paddingBottom: space.stack.xs,
  },
  composerImagePreviewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 20, // design-token-ignore: matches composerImagePreview
  },
  composerImagePreview: {
    width: ATTACHMENT_IMAGE_SIZE, // design-token-ignore: Image ignores className size
    height: ATTACHMENT_IMAGE_SIZE, // design-token-ignore: square preview
    borderRadius: 20, // design-token-ignore: slightly tighter than radius.composer (24)
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  composerImageRemove: {
    position: 'absolute',
    top: space.stack.sm,
    right: space.stack.sm,
    zIndex: 2,
  },
  composerFilePreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.stack.sm,
    paddingVertical: space.stack.sm,
    gap: space.stack.sm,
  },
  composerFileName: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: type.caption.fontWeight as '400',
    letterSpacing: type.caption.letterSpacing,
    textAlign: 'center',
  },
  composerRow: {
    position: 'relative',
    paddingHorizontal: space.stack.sm,
    paddingVertical: space.stack.sm,
    zIndex: 30,
  },
  composerInputHost: {
    position: 'relative',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  composerFocusHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  composerTextFrame: {
    ...StyleSheet.absoluteFillObject,
    minWidth: 0,
    zIndex: 2,
    overflow: 'visible',
  },
  composerInput: {
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    includeFontPadding: false,
    overflow: 'visible',
  },
  composerInputSpacer: {
    ...StyleSheet.absoluteFillObject,
  },
  composerPlus: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stack.sm,
  },
  composerSend: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
});
