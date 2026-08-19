import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ApplicationArtifactV1, ApplicationReviewOutcome } from '@shared/application';
import { TEXT_SECONDARY, TEXT_PRIMARY, EDITORIAL_TEXT, RADII } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { stepHaptic } from '../context/AppSessionContext';
import { useSourceViewer } from '../context/SourceViewerContext';
import { ReadingText } from '../context/TypographyContext';
import { color, primitive, type, typography } from '@shared/design-tokens';

type Props = {
  application: ApplicationArtifactV1;
  onStartAction?: () => void;
  onEditContext?: () => void;
  onSubmitReview?: (args: {
    outcome: ApplicationReviewOutcome;
    privateNote?: string;
    failedAssumptionId?: string;
    wantsAdjust: boolean;
    wantsRepeat: boolean;
  }) => void;
};

const SECTION_GAP = 14;

export default function ApplicationPlanView({
  application,
  onStartAction,
  onEditContext,
  onSubmitReview,
}: Props) {
  const { isDark } = useTheme();
  const sourceViewer = useSourceViewer();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [note, setNote] = useState('');
  const [failedAssumptionId, setFailedAssumptionId] = useState<string | undefined>();
  const plan = application.plan;
  const action = plan.action;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const cardBg = isDark ? color.background.whiteFade06 : color.background.blackFade04;
  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).duration(260);

  const Section = ({
    title,
    children,
    delay,
  }: {
    title: string;
    children: React.ReactNode;
    delay: number;
  }) => (
    <Animated.View entering={enter(delay)} style={[styles.card, { backgroundColor: cardBg }]}>
      <Text style={styles.kicker} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </Animated.View>
  );

  if (plan.status === 'needs_context') {
    return (
      <View style={styles.root} accessibilityRole="summary">
        <Section title="Contexto" delay={0}>
          <ReadingText typeRole="readingBody" style={styles.body}>
            {plan.needsContextPrompt || '¿Qué resultado concreto quieres probar?'}
          </ReadingText>
          <Pressable
            onPress={() => {
              stepHaptic();
              onEditContext?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar contexto"
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Añadir contexto</Text>
          </Pressable>
        </Section>
        {plan.sourceBasis ? (
          <Section title="De la fuente" delay={40}>
            <ReadingText typeRole="readingBody" style={styles.body}>{plan.sourceBasis}</ReadingText>
          </Section>
        ) : null}
      </View>
    );
  }

  if (plan.status === 'abstained') {
    return (
      <View style={styles.root}>
        <Section title="Sin aplicación responsable" delay={0}>
          <ReadingText typeRole="readingBody" style={styles.body}>{plan.abstentionReason || plan.inference}</ReadingText>
        </Section>
        {plan.sourceBasis ? (
          <Section title="De la fuente" delay={40}>
            <ReadingText typeRole="readingBody" style={styles.body}>{plan.sourceBasis}</ReadingText>
          </Section>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLabel="Plan de aplicación">
      {plan.status === 'provisional' ? (
        <Text style={styles.banner} maxFontSizeMultiplier={1.2}>
          Plan provisional — puedes corregir los supuestos.
        </Text>
      ) : null}
      {plan.status === 'in_progress' ? (
        <Text style={styles.banner} maxFontSizeMultiplier={1.2}>
          Acción en curso
          {plan.startedAt ? ` · desde ${plan.startedAt.slice(0, 16).replace('T', ' ')}` : ''}.
        </Text>
      ) : null}

      <Section title="De la fuente" delay={0}>
        <ReadingText typeRole="readingBody" style={styles.body}>{plan.sourceBasis}</ReadingText>
        {plan.sourceChunkIds[0] ? (
          <Pressable
            onPress={() => sourceViewer.openCitation(plan.sourceChunkIds[0]!)}
            accessibilityRole="button"
            accessibilityLabel="Ver fragmento de la fuente"
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>Ver fragmento</Text>
          </Pressable>
        ) : null}
      </Section>

      <Section title="Inferencia de Núcleo" delay={40}>
        <ReadingText typeRole="readingBody" style={styles.body}>{plan.inference}</ReadingText>
      </Section>

      <Section title="Adaptación para ti" delay={80}>
        <ReadingText typeRole="readingBody" style={styles.body}>{plan.adaptation}</ReadingText>
        <Pressable
          onPress={() => {
            stepHaptic();
            onEditContext?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Editar contexto"
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Editar contexto</Text>
        </Pressable>
      </Section>

      {plan.assumptions.length ? (
        <Section title="Supuestos" delay={120}>
          {plan.assumptions.map((a) => (
            <Text key={a.id} style={styles.bullet}>
              • {a.text}
              {a.editable ? ' (editable)' : ''}
            </Text>
          ))}
        </Section>
      ) : null}

      {action ? (
        <Animated.View
          entering={enter(160)}
          style={[styles.heroCard, { backgroundColor: isDark ? color.background.accentFade16 : color.background.accentSofter }]}
        >
          <Text style={styles.kicker}>Próxima acción</Text>
          <ReadingText typeRole="readingLead" style={styles.heroText}>
            {action.verbLedInstruction}
          </ReadingText>
          <Text style={styles.meta}>
            {action.whenOrTrigger} · {action.durationOrScope}
          </Text>
          <Pressable
            onPress={() => {
              stepHaptic();
              onStartAction?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Empezar acción"
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Empezar acción</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {action ? (
        <>
          <Section title="Cómo comprobarlo" delay={200}>
            <ReadingText typeRole="readingBody" style={styles.body}>{action.successCriterion}</ReadingText>
          </Section>
          <Section title="Cuándo parar o cambiar" delay={240}>
            <ReadingText typeRole="readingBody" style={styles.body}>{action.stopOrChangeCriterion}</ReadingText>
          </Section>
          <Section title="Revisión" delay={280}>
            <ReadingText typeRole="readingBody" style={styles.body}>{plan.reviewTrigger}</ReadingText>
            {plan.reviewQuestions.map((q) => (
              <Text key={q} style={styles.bullet}>
                • {q}
              </Text>
            ))}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Nota privada (opcional)"
              placeholderTextColor={TEXT_SECONDARY}
              style={[styles.note, { color: isDark ? TEXT_PRIMARY : EDITORIAL_TEXT }]}
              multiline
              accessibilityLabel="Nota privada de revisión"
            />
            {plan.assumptions.length ? (
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={[styles.meta, { marginBottom: 2 }]}>
                  Si falló un supuesto, márcalo (parcial / no / abandoné):
                </Text>
                {plan.assumptions.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() =>
                      setFailedAssumptionId((prev) => (prev === a.id ? undefined : a.id))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Supuesto fallido: ${a.text}`}
                    accessibilityState={{ selected: failedAssumptionId === a.id }}
                    style={[
                      styles.reviewChip,
                      failedAssumptionId === a.id
                        ? { backgroundColor: color.background.dangerFade35 }
                        : null,
                    ]}
                  >
                    <Text style={styles.reviewChipText} numberOfLines={2}>
                      {failedAssumptionId === a.id ? '✓ ' : ''}
                      {a.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.reviewRow}>
              {(
                [
                  ['worked', 'Funcionó'],
                  ['partial', 'Parcial'],
                  ['did_not_work', 'No'],
                  ['abandoned', 'Abandoné'],
                ] as const
              ).map(([outcome, label]) => (
                <Pressable
                  key={outcome}
                  onPress={() => {
                    stepHaptic();
                    const needsAssumption =
                      outcome === 'partial' ||
                      outcome === 'did_not_work' ||
                      outcome === 'abandoned';
                    onSubmitReview?.({
                      outcome,
                      privateNote: note.trim() || undefined,
                      failedAssumptionId: needsAssumption ? failedAssumptionId : undefined,
                      wantsAdjust: outcome === 'partial' || outcome === 'did_not_work',
                      wantsRepeat: outcome === 'worked',
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={styles.reviewChip}
                >
                  <Text style={styles.reviewChipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SECTION_GAP, paddingHorizontal: 4, paddingBottom: 24 },
  card: { borderRadius: RADII.md, padding: 16, gap: 8 },
  heroCard: { borderRadius: RADII.lg, padding: 18, gap: 10 },
  kicker: {
    ...typography('planKicker'),
    color: TEXT_SECONDARY,
  },
  body: { ...typography('planBody') },
  bullet: { ...typography('planBullet') },
  heroText: { ...typography('planHero') },
  meta: { fontSize: type.callout.fontSize, color: TEXT_SECONDARY },
  primaryBtn: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background.accentSolid95,
    paddingHorizontal: 16,
  },
  primaryBtnText: { ...typography('inputBold'), color: primitive.color.neutral['1000'] },
  secondaryBtn: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background.whiteFade08,
  },
  secondaryBtnText: { ...typography('buttonTitle'), color: TEXT_PRIMARY },
  linkBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography('bodySemibold'), color: primitive.color.brand.accentSoft },
  banner: {
    fontSize: type.callout.fontSize,
    color: TEXT_SECONDARY,
    paddingHorizontal: 4,
  },
  note: {
    minHeight: 72,
    borderRadius: RADII.sm,
    padding: 12,
    backgroundColor: color.background.whiteFade06,
    fontSize: type.title.fontSize,
    marginTop: 8,
  },
  reviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  reviewChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    backgroundColor: color.background.whiteFade08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewChipText: { ...typography('calloutSemibold'), color: TEXT_PRIMARY },
});
