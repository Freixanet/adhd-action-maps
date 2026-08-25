import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppSession } from '../context/AppSessionContext';
import { useTheme } from '../context/ThemeContext';
import { TEXT_SECONDARY, TEXT_PRIMARY, EDITORIAL_TEXT, RADII } from '@shared/uiTokens';
import ApplicationContextEditor from './ApplicationContextEditor';
import { color, primitive, type, typography } from '@shared/design-tokens';

/**
 * Compact S06 context capture — primary goal + expandable fields.
 */
export default function ApplicationContextBar() {
  const { intent, applicationContext, setApplicationContext } = useAppSession();
  const { isDark } = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  if (intent !== 'apply') return null;

  const hasExtra =
    Boolean(applicationContext.situation) ||
    Boolean(applicationContext.constraint) ||
    Boolean(applicationContext.horizon);

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 8,
        padding: 12,
        borderRadius: RADII.sm,
        backgroundColor: isDark ? color.background.whiteFade06 : color.background.blackFade04,
        gap: 8,
      }}
      accessibilityLabel="Contexto para aplicar"
    >
      <Text
        style={{
          ...typography('metaKicker'),
          color: TEXT_SECONDARY,
        }}
      >
        Tu contexto
      </Text>
      <TextInput
        value={applicationContext.goal ?? ''}
        onChangeText={(goal) => setApplicationContext({ ...applicationContext, goal })}
        placeholder="¿Qué resultado concreto quieres probar?"
        placeholderTextColor={TEXT_SECONDARY}
        style={{
          minHeight: 44,
          fontSize: type.title.fontSize,
          color: isDark ? TEXT_PRIMARY : EDITORIAL_TEXT,
        }}
        accessibilityLabel="Objetivo"
      />
      {hasExtra ? (
        <Text style={{ fontSize: type.label.fontSize, color: TEXT_SECONDARY }} numberOfLines={2}>
          {[
            applicationContext.situation,
            applicationContext.constraint,
            applicationContext.horizon,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setEditorOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Más contexto"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: primitive.color.brand.accentSoft, ...typography('bodySemibold') }}>
          {hasExtra ? 'Editar contexto completo' : 'Más contexto (situación, restricción, horizonte)'}
        </Text>
      </Pressable>

      <ApplicationContextEditor
        visible={editorOpen}
        initial={applicationContext}
        onClose={() => setEditorOpen(false)}
        onSave={(ctx) => {
          setApplicationContext(ctx);
          setEditorOpen(false);
        }}
      />
    </View>
  );
}
