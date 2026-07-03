import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, X } from 'lucide-react-native';
import AttachMenu from '../components/AttachMenu';
import AttachMenuOverlay from '../components/AttachMenuOverlay';
import ComposerDismissScroll from '../components/ComposerDismissScroll';
import ComposerSendButton from '../components/ComposerSendButton';
import ComposerSurface from '../components/ComposerSurface';
import ComposerDock, { useComposerKeyboardLift } from '../components/ComposerDock';
import ContinueChip from '../components/ContinueChip';
import FloatingGlassButton from '../components/FloatingGlassButton';
import GlassSurface from '../components/GlassSurface';
import IntentSelector from '../components/IntentSelector';
import MenuTwoLines from '../components/MenuTwoLines';
import ModelChip from '../components/ModelChip';
import SessionErrorBanner from '../components/SessionErrorBanner';
import { SIDEBAR_HEADER_BUTTON_SIZE } from '../components/sidebarLayout';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';
import EngravedNucleoMark from '../components/EngravedNucleoMark';
import { useAttachMenuControl } from '../hooks/useAttachMenuControl';
import { KeyboardDismissBackdrop } from '../logic/keyboardDismiss';
import {
  COMPOSER_LINE_HEIGHT,
  COMPOSER_MAX_VIEWPORT_RATIO,
  COMPOSER_REST_INPUT_HEIGHT,
  formatPastedTextChipLabel,
} from '../logic/composerText';

const STATIC_PLACEHOLDER = 'Pega texto, un enlace, un vídeo o un PDF';
const FIRST_USE_EXAMPLES = [
  'https://www.youtube.com/watch?v=example',
  'Pega un artículo sobre hábitos o atención…',
  'https://ejemplo.com/articulo-sobre-foco',
] as const;

export default function InputScreen() {
  const session = useAppSession();
  const { isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const maxComposerInputHeight = Math.round(windowHeight * COMPOSER_MAX_VIEWPORT_RATIO);
  const canSend = session.canSubmit && session.phase !== 'loading';
  const navIconColor = isDark ? '#d4d4d4' : '#525252';
  const mutedIcon = isDark ? '#a3a3a3' : '#737373';
  const [composerHeight, setComposerHeight] = useState(176);
  const [composerFocused, setComposerFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [examplesFinished, setExamplesFinished] = useState(false);
  const composerInputRef = useRef<TextInput>(null);
  const keyboardLiftStyle = useComposerKeyboardLift();
  const { anchorRef, anchorRect, handleAttachToggle, dismissAttachMenu, clearPendingOpen } =
    useAttachMenuControl({
      attachMenuOpen: session.attachMenuOpen,
      setAttachMenuOpen: session.setAttachMenuOpen,
      composerHeight,
      composerInputRef,
      composerFocused,
      phase: session.phase,
    });

  const isFirstUse = !session.hasAnyNucleo;
  const showHero =
    !session.canSubmit && !composerFocused && !session.uploadedFile && !session.pastedText;

  const inputPlaceholder =
    session.uploadedFile || session.hasAnyNucleo || examplesFinished
      ? session.composerPlaceholder
      : FIRST_USE_EXAMPLES[exampleIndex] ?? STATIC_PLACEHOLDER;

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
    if (!isFirstUse || examplesFinished || composerFocused || session.inputText.trim()) return;
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

  const menusBlockScroll = session.attachMenuOpen || session.historyOpen;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-base">
      <View className="flex-1 px-3" style={{ position: 'relative' }}>
        <View className="flex-row items-center justify-between pt-1 pb-3">
          <FloatingGlassButton
            onPress={() => session.toggleHistoryDrawer()}
            accessibilityLabel={session.historyOpen ? 'Cerrar navegacion' : 'Abrir navegacion'}
            shape="circle"
            size={SIDEBAR_HEADER_BUTTON_SIZE}
          >
            <MenuTwoLines size={17} color={navIconColor} />
          </FloatingGlassButton>
          <IntentSelector
            value={session.intent}
            onChange={session.setIntent}
            disabled={session.phase === 'loading' || session.attachMenuOpen}
          />
          <View className="w-9" />
        </View>

        <SessionErrorBanner />

        <Animated.View style={[{ flex: 1 }, keyboardLiftStyle]}>
          <ScrollView
            className="flex-1 bg-transparent"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!menusBlockScroll}
            alwaysBounceVertical={Platform.OS === 'ios' && keyboardVisible}
            onScrollBeginDrag={clearPendingOpen}
            contentContainerClassName="px-1"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: composerHeight + 16 }}
          >
            <KeyboardDismissBackdrop className="w-full flex-1 items-center justify-center">
              <View className="w-full items-center px-2" style={{ marginTop: showHero ? -24 : 0 }}>
                {showHero ? (
                  <>
                    <Pressable
                      onLongPress={() => {
                        if (!__DEV__) return;
                        if (session.devHistoryHidden) {
                          Alert.alert(
                            'Restaurar historial (dev)',
                            '¿Recuperar tu historial guardado?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Restaurar',
                                onPress: () => session.devRestoreHistory?.(),
                              },
                            ]
                          );
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
                      }}
                      delayLongPress={700}
                      accessibilityRole="button"
                      accessibilityLabel="nucleo"
                    >
                      <EngravedNucleoMark style={{ marginBottom: 24 }} />
                    </Pressable>
                    <Text className="text-center text-[15px] leading-6 text-secondary">
                      Separa lo importante del ruido.
                    </Text>
                    {isFirstUse ? (
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
                                Ver un ejemplo{' '}
                                <Text className="text-secondary">→</Text>
                              </Text>
                            </View>
                          </GlassSurface>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
            </KeyboardDismissBackdrop>
          </ScrollView>
        </Animated.View>

        <ComposerDock onHeightChange={setComposerHeight}>
          {session.continueEntry ? (
            <View className="mb-3 w-full items-center">
              <ContinueChip
                entry={session.continueEntry}
                onPress={() => session.handleSelectHistory(session.continueEntry!.id)}
                onDismiss={session.dismissContinueChip}
              />
            </View>
          ) : null}
          <ComposerDismissScroll>
            <ComposerSurface focused={composerFocused} inputRef={composerInputRef}>
              <View pointerEvents={session.attachMenuOpen ? 'none' : 'auto'}>
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
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface-2 items-center justify-center"
                        >
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-2 self-start max-w-full px-3 py-1.5 rounded-full bg-white/10">
                        <File size={16} color={mutedIcon} />
                        <Text className="text-sm shrink text-primary" numberOfLines={1}>
                          {session.uploadedFile.name}
                        </Text>
                        <Pressable onPress={session.removeUploadedFile} className="p-0.5 rounded-full">
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
                    placeholder={inputPlaceholder}
                    placeholderTextColor={isDark ? '#9CA0AB' : '#737373'}
                    multiline
                    textAlignVertical="top"
                    editable={!session.attachMenuOpen}
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
              </View>

              <View className="flex-row items-center justify-between px-3 pb-4 pt-1.5 gap-2">
                <View className="flex-row items-center gap-2 shrink">
                  <AttachMenu
                    anchorRef={anchorRef}
                    open={session.attachMenuOpen}
                    onToggle={handleAttachToggle}
                    disabled={session.phase === 'loading'}
                    darkSurface={isDark}
                  />
                  <ModelChip
                    value={session.depthPreference}
                    onChange={session.setDepthPreference}
                    onOpenPaywall={session.openPaywall}
                    disabled={session.phase === 'loading' || session.attachMenuOpen}
                  />
                </View>
                <ComposerSendButton
                  onPress={() => {
                    clearPendingOpen();
                    void session.handleTransform();
                  }}
                  disabled={!canSend || session.attachMenuOpen}
                />
              </View>
            </ComposerSurface>
          </ComposerDismissScroll>
        </ComposerDock>

        <AttachMenuOverlay
          open={session.attachMenuOpen}
          anchorRect={anchorRect}
          onClose={dismissAttachMenu}
          onPickImage={() => void session.handlePickImage()}
          onPickCamera={() => void session.handlePickCamera()}
          onPickFile={() => void session.handlePickFile()}
          darkSurface={isDark}
        />
      </View>
    </SafeAreaView>
  );
}
