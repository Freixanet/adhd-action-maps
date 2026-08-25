import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatGeminiModelLabel } from '@shared/geminiModelChain';
import { space, type } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';

function modelCaption(modelUsed?: string | null): string {
  return formatGeminiModelLabel(modelUsed) ?? 'Modelo no registrado';
}

type DevModelCaptionProps = {
  modelUsed?: string | null;
  enabled: boolean;
};

/** Always-on muted line for generated Núcleos in DEV mode. */
export function DevModelCaption({ modelUsed, enabled }: DevModelCaptionProps) {
  const colors = useThemeColors();
  const { font } = useTypography();
  if (!enabled) return null;
  return (
    <Text
      style={[styles.caption, { color: colors.text.muted, fontFamily: font.family }]}
      maxFontSizeMultiplier={1.2}
    >
      {modelCaption(modelUsed)}
    </Text>
  );
}

type DevModelLongPressProps = {
  enabled: boolean;
  modelUsed?: string | null;
  children: React.ReactNode;
};

/** Reveals the model on long-press of a model output (chat / ask). */
export function DevModelLongPress({
  enabled,
  modelUsed,
  children,
}: DevModelLongPressProps) {
  const colors = useThemeColors();
  const { font } = useTypography();
  const [open, setOpen] = useState(false);
  if (!enabled) return <>{children}</>;

  return (
    <Pressable
      onLongPress={() => {
        setOpen((current) => !current);
      }}
      delayLongPress={380}
      accessibilityHint="Mantén pulsado para ver el modelo"
    >
      {children}
      {open ? (
        <View style={styles.reveal}>
          <Text
            style={[styles.caption, { color: colors.text.muted, fontFamily: font.family }]}
            maxFontSizeMultiplier={1.2}
          >
            {modelCaption(modelUsed)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: {
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: type.micro.fontWeight as '500',
    letterSpacing: type.micro.letterSpacing,
  },
  reveal: {
    marginTop: space.stack.xs,
  },
});
