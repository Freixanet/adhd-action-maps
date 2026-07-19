import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FileText, Link, Play } from 'lucide-react-native';
import {
  countWords,
  formatInlineFileSize,
  formatLinkDomain,
  truncateMiddleName,
  type InlineAttachmentSnapshot,
  type InlineUserTurnSnapshot,
} from '../logic/inlineUserBubble';

const BUBBLE_ENTER_MS = 200;
const REDUCED_FADE_MS = 150;

function enterOpacity(reduceMotion: boolean) {
  return withTiming(1, {
    duration: reduceMotion ? REDUCED_FADE_MS : BUBBLE_ENTER_MS,
    easing: Easing.out(Easing.ease),
  });
}

function enterTranslateY(reduceMotion: boolean) {
  return reduceMotion
    ? 0
    : withTiming(0, { duration: BUBBLE_ENTER_MS, easing: Easing.out(Easing.ease) });
}

type BubbleMode =
  | { kind: 'mixed'; attachment: InlineAttachmentSnapshot; text: string }
  | { kind: 'mixedPasted'; attachment: InlineAttachmentSnapshot; wordCount: number }
  | { kind: 'shortText'; text: string }
  | { kind: 'longTextChip'; wordCount: number }
  | { kind: 'link'; domain: string; title: string | null }
  | { kind: 'youtube'; title: string | null }
  | { kind: 'pdf'; files: InlineAttachmentSnapshot[] }
  | { kind: 'image'; file: InlineAttachmentSnapshot };

function resolveBubbleMode(snapshot: InlineUserTurnSnapshot): BubbleMode {
  const attachment = snapshot.attachments[0] ?? null;
  const writtenText = snapshot.text?.trim() || '';
  const pastedText = snapshot.pastedText?.trim() || '';

  if (attachment && writtenText && !snapshot.urlKind && !pastedText) {
    return { kind: 'mixed', attachment, text: writtenText };
  }

  if (attachment && pastedText) {
    return { kind: 'mixedPasted', attachment, wordCount: countWords(pastedText) };
  }

  if (snapshot.urlKind === 'youtube' && snapshot.sourceUrl) {
    return { kind: 'youtube', title: snapshot.linkTitle?.trim() || null };
  }

  if (snapshot.urlKind === 'link' && snapshot.sourceUrl) {
    return {
      kind: 'link',
      domain: formatLinkDomain(snapshot.sourceUrl),
      title: snapshot.linkTitle?.trim() || null,
    };
  }

  if (attachment?.isImage) {
    return { kind: 'image', file: attachment };
  }

  if (attachment?.isPdf || attachment) {
    const pdfs = snapshot.attachments.filter((file) => file.isPdf || !file.isImage);
    return { kind: 'pdf', files: pdfs.length > 0 ? pdfs : [attachment] };
  }

  if (pastedText) {
    return { kind: 'longTextChip', wordCount: countWords(pastedText) };
  }

  return { kind: 'shortText', text: writtenText };
}

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <Text className="flex-1 text-[14px] text-secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function AttachmentBlock({
  attachment,
  mutedIcon,
}: {
  attachment: InlineAttachmentSnapshot;
  mutedIcon: string;
}) {
  if (attachment.isImage && attachment.previewUri) {
    return <ImageAttachmentRow file={attachment} />;
  }
  if (attachment.isPdf) {
    return <PdfRows files={[attachment]} mutedIcon={mutedIcon} />;
  }
  return (
    <MetaRow
      icon={<FileText size={16} color={mutedIcon} />}
      label={`${truncateMiddleName(attachment.name)}${
        attachment.size ? ` · ${formatInlineFileSize(attachment.size)}` : ''
      }`}
    />
  );
}

function PdfRows({
  files,
  mutedIcon,
}: {
  files: InlineAttachmentSnapshot[];
  mutedIcon: string;
}) {
  const visible = files.slice(0, 3);
  const extra = files.length - visible.length;

  return (
    <View className="gap-1">
      {visible.map((file) => (
        <MetaRow
          key={file.name}
          icon={<FileText size={16} color={mutedIcon} />}
          label={`${truncateMiddleName(file.name)}${
            file.size ? ` · ${formatInlineFileSize(file.size)}` : ''
          }`}
        />
      ))}
      {extra > 0 ? (
        <Text className="text-[14px] text-secondary">{`+${extra} más`}</Text>
      ) : null}
    </View>
  );
}

function ImageAttachmentRow({ file }: { file: InlineAttachmentSnapshot }) {
  return (
    <View className="flex-row items-center gap-3">
      <Image
        source={{ uri: file.previewUri }}
        accessibilityIgnoresInvertColors
        className="h-12 w-12 rounded-lg"
        style={{ width: 48, height: 48, borderRadius: 8 }}
        resizeMode="cover"
      />
      <Text className="flex-1 text-[14px] text-secondary" numberOfLines={1}>
        {`${truncateMiddleName(file.name)}${
          file.size ? ` · ${formatInlineFileSize(file.size)}` : ''
        }`}
      </Text>
    </View>
  );
}

function BubbleBody({ snapshot, mutedIcon }: { snapshot: InlineUserTurnSnapshot; mutedIcon: string }) {
  const mode = resolveBubbleMode(snapshot);

  switch (mode.kind) {
    case 'shortText':
      return (
        <Text
          className="text-[15px] leading-[22px] text-primary"
          numberOfLines={2}
          ellipsizeMode="tail"
          selectable={false}
        >
          {mode.text}
        </Text>
      );

    case 'longTextChip': {
      const wordLabel = mode.wordCount === 1 ? 'palabra' : 'palabras';
      return (
        <MetaRow
          icon={<FileText size={16} color={mutedIcon} />}
          label={`Texto · ${mode.wordCount} ${wordLabel}`}
        />
      );
    }

    case 'link':
      return (
        <View className="gap-1">
          <MetaRow icon={<Link size={16} color={mutedIcon} />} label={mode.domain} />
          {mode.title ? (
            <Text
              className="text-[15px] text-primary"
              numberOfLines={1}
              ellipsizeMode="tail"
              selectable={false}
            >
              {mode.title}
            </Text>
          ) : null}
        </View>
      );

    case 'youtube':
      return (
        <View className="gap-1">
          <MetaRow icon={<Play size={16} color={mutedIcon} />} label="YouTube" />
          {mode.title ? (
            <Text
              className="text-[15px] text-primary"
              numberOfLines={1}
              ellipsizeMode="tail"
              selectable={false}
            >
              {mode.title}
            </Text>
          ) : null}
        </View>
      );

    case 'pdf':
      return <PdfRows files={mode.files} mutedIcon={mutedIcon} />;

    case 'image':
      return <ImageAttachmentRow file={mode.file} />;

    case 'mixed':
      return (
        <View className="gap-2">
          <AttachmentBlock attachment={mode.attachment} mutedIcon={mutedIcon} />
          <Text
            className="text-[15px] leading-[22px] text-primary"
            numberOfLines={2}
            ellipsizeMode="tail"
            selectable={false}
          >
            {mode.text}
          </Text>
        </View>
      );

    case 'mixedPasted':
      return (
        <View className="gap-2">
          <AttachmentBlock attachment={mode.attachment} mutedIcon={mutedIcon} />
          <MetaRow
            icon={<FileText size={16} color={mutedIcon} />}
            label={`Texto · ${mode.wordCount} ${mode.wordCount === 1 ? 'palabra' : 'palabras'}`}
          />
        </View>
      );
  }
}

type InlineUserBubbleProps = {
  snapshot: InlineUserTurnSnapshot;
  reduceMotion: boolean;
  maxWidth: number;
  mutedIcon: string;
};

export default function InlineUserBubble({
  snapshot,
  reduceMotion,
  maxWidth,
  mutedIcon,
}: InlineUserBubbleProps) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 8);

  useEffect(() => {
    opacity.value = enterOpacity(reduceMotion);
    translateY.value = enterTranslateY(reduceMotion);
  }, [opacity, reduceMotion, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ maxWidth, alignSelf: 'flex-end' }, style]}>
      <View className="rounded-2xl bg-surface-2 px-4 py-3" pointerEvents="none">
        <BubbleBody snapshot={snapshot} mutedIcon={mutedIcon} />
      </View>
    </Animated.View>
  );
}
