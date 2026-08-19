import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApplicationContextV1 } from '@shared/application';
import { TEXT_SECONDARY, TEXT_PRIMARY, EDITORIAL_TEXT, RADII } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { color, primitive, type, typography } from '@shared/design-tokens';

type Props = {
  visible: boolean;
  initial: ApplicationContextV1;
  assumptions?: Array<{ id: string; text: string; editable: boolean }>;
  onClose: () => void;
  onSave: (ctx: ApplicationContextV1, assumptionEdits?: Record<string, string>) => void;
  title?: string;
};

/**
 * Progressive context editor: one primary question, expandable fields.
 * Used from composer (inline) and from result «Editar contexto».
 */
export default function ApplicationContextEditor({
  visible,
  initial,
  assumptions,
  onClose,
  onSave,
  title = 'Contexto para aplicar',
}: Props) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [goal, setGoal] = useState(initial.goal ?? '');
  const [situation, setSituation] = useState(initial.situation ?? '');
  const [constraint, setConstraint] = useState(initial.constraint ?? '');
  const [horizon, setHorizon] = useState(initial.horizon ?? '');
  const [expanded, setExpanded] = useState(
    Boolean(initial.situation || initial.constraint || initial.horizon)
  );
  const [assumptionEdits, setAssumptionEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setGoal(initial.goal ?? '');
    setSituation(initial.situation ?? '');
    setConstraint(initial.constraint ?? '');
    setHorizon(initial.horizon ?? '');
    setExpanded(Boolean(initial.situation || initial.constraint || initial.horizon));
    setAssumptionEdits({});
  }, [visible, initial]);

  const fieldStyle = {
    minHeight: 44,
    fontSize: type.title.fontSize,
    color: isDark ? TEXT_PRIMARY : EDITORIAL_TEXT,
    borderRadius: RADII.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: isDark ? color.background.whiteFade06 : color.background.blackFade04,
    marginBottom: 10,
  } as const;

  const editableAssumptions = (assumptions ?? []).filter((a) => a.editable);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? primitive.color.neutral['1000'] : color.background.lightCanvas,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: 16,
        }}
        accessibilityLabel={title}
      >
        <Text
          style={{
            ...typography('metaKicker'),
            color: TEXT_SECONDARY,
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: type.body.fontSize, color: TEXT_SECONDARY, marginBottom: 6 }}>
            ¿Qué resultado concreto quieres probar?
          </Text>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            placeholder="Objetivo"
            placeholderTextColor={TEXT_SECONDARY}
            style={fieldStyle}
            accessibilityLabel="Objetivo"
          />

          {!expanded ? (
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Más contexto"
              style={{ minHeight: 44, justifyContent: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: primitive.color.brand.accentSoft, ...typography('bodySemibold') }}>Más contexto</Text>
            </Pressable>
          ) : (
            <>
              <Text style={{ fontSize: type.body.fontSize, color: TEXT_SECONDARY, marginBottom: 6 }}>
                Situación
              </Text>
              <TextInput
                value={situation}
                onChangeText={setSituation}
                placeholder="Dónde / en qué momento estás"
                placeholderTextColor={TEXT_SECONDARY}
                style={fieldStyle}
                accessibilityLabel="Situación"
              />
              <Text style={{ fontSize: type.body.fontSize, color: TEXT_SECONDARY, marginBottom: 6 }}>
                Restricción
              </Text>
              <TextInput
                value={constraint}
                onChangeText={setConstraint}
                placeholder="Tiempo, energía, herramientas…"
                placeholderTextColor={TEXT_SECONDARY}
                style={fieldStyle}
                accessibilityLabel="Restricción"
              />
              <Text style={{ fontSize: type.body.fontSize, color: TEXT_SECONDARY, marginBottom: 6 }}>
                Horizonte
              </Text>
              <TextInput
                value={horizon}
                onChangeText={setHorizon}
                placeholder="Cuándo puedes probarlo"
                placeholderTextColor={TEXT_SECONDARY}
                style={fieldStyle}
                accessibilityLabel="Horizonte"
              />
            </>
          )}

          {editableAssumptions.length ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              <Text
                style={{
                  ...typography('metaKicker'),
                  color: TEXT_SECONDARY,
                }}
              >
                Supuestos editables
              </Text>
              {editableAssumptions.map((a) => (
                <TextInput
                  key={a.id}
                  value={assumptionEdits[a.id] ?? a.text}
                  onChangeText={(t) =>
                    setAssumptionEdits((prev) => ({ ...prev, [a.id]: t }))
                  }
                  style={fieldStyle}
                  accessibilityLabel={`Supuesto ${a.id}`}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: RADII.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color.background.whiteFade08,
            }}
          >
            <Text style={{ ...typography('buttonTitle'), color: isDark ? TEXT_PRIMARY : EDITORIAL_TEXT }}>
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onSave(
                {
                  goal: goal.trim() || undefined,
                  situation: situation.trim() || undefined,
                  constraint: constraint.trim() || undefined,
                  horizon: horizon.trim() || undefined,
                },
                Object.keys(assumptionEdits).length ? assumptionEdits : undefined
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Guardar contexto"
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: RADII.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color.background.accentSolid95,
            }}
          >
            <Text style={{ ...typography('buttonTitleBold'), color: primitive.color.neutral['1000'] }}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
