import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { typography, type TypeRole } from '@shared/design-tokens';
import { useThemeColors } from './ThemeContext';
import {
  getInitialReadingSizePreference,
  readingSizeScale,
  READING_SIZE_OPTIONS,
  saveReadingSizePreference,
  type ReadingSizePreference,
} from '../logic/readingTypographyPreference';
import {
  getInitialReadingFontPreference,
  readingFontFamily,
  readingItalicFontFamily,
  READING_FONT_OPTIONS,
  saveReadingFontPreference,
  type ReadingFontPreference,
} from '../logic/readingFontPreference';

type TypographyContextValue = {
  readingSize: ReadingSizePreference;
  readingScale: number;
  setReadingSize: (value: ReadingSizePreference) => void;
  options: typeof READING_SIZE_OPTIONS;
  readingFont: ReadingFontPreference;
  setReadingFont: (value: ReadingFontPreference) => void;
  fontOptions: typeof READING_FONT_OPTIONS;
  font: { family: string; italicFamily: string };
};

const TypographyContext = createContext<TypographyContextValue | null>(null);

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [readingSize, setReadingSizeState] = useState<ReadingSizePreference>(() =>
    getInitialReadingSizePreference()
  );
  const [readingFont, setReadingFontState] = useState<ReadingFontPreference>(() =>
    getInitialReadingFontPreference()
  );
  const setReadingSize = useCallback((value: ReadingSizePreference) => {
    setReadingSizeState(value);
    saveReadingSizePreference(value);
  }, []);
  const setReadingFont = useCallback((value: ReadingFontPreference) => {
    setReadingFontState(value);
    saveReadingFontPreference(value);
  }, []);
  const font = useMemo(
    () => ({
      family: readingFontFamily(readingFont, Platform.OS),
      italicFamily: readingItalicFontFamily(Platform.OS),
    }),
    [readingFont]
  );
  const value = useMemo(
    () => ({
      readingSize,
      readingScale: readingSizeScale(readingSize),
      setReadingSize,
      options: READING_SIZE_OPTIONS,
      readingFont,
      setReadingFont,
      fontOptions: READING_FONT_OPTIONS,
      font,
    }),
    [font, readingFont, readingSize, setReadingFont, setReadingSize]
  );
  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>;
}

export function useTypography() {
  const context = useContext(TypographyContext);
  if (!context) throw new Error('useTypography must be used within TypographyProvider');
  return context;
}

type NucleoTextProps = TextProps & {
  typeRole?: TypeRole;
  reading?: boolean;
  className?: string;
};

/** Semantic text primitive for long-form content and editorial copy. */
export function NucleoText({ typeRole = 'body', reading = false, style, ...props }: NucleoTextProps) {
  const { readingScale, font } = useTypography();
  const colors = useThemeColors();
  const base = typography(typeRole);
  const scaled: TextStyle = reading
    ? {
        fontSize: base.fontSize * readingScale,
        lineHeight: base.lineHeight * readingScale,
      }
    : {};
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        base,
        { color: colors.text.body, fontFamily: font.family },
        scaled,
        style,
      ]}
    />
  );
}

export function ReadingText(props: Omit<NucleoTextProps, 'reading'>) {
  return <NucleoText {...props} reading />;
}

export function ReadingColumn({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.readingColumn, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  readingColumn: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
