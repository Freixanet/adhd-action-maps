import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  selectVisualAsset,
  selectVisualAssetsForIntents,
} from '@shared/editorial/selectVisualAsset';
import type { VisualIntent } from '@shared/editorial/visualLibrary';
import {
  EDITORIAL_GRAPHIC_YELLOW,
  EDITORIAL_TEXT,
  EDITORIAL_TEXT_MUTED,
} from '@shared/editorial/colors';
import EditorialIllustrationRenderer from './EditorialIllustrationRenderer';
import { RADII } from '@shared/uiTokens';
import { motion, color, type, typography } from '@shared/design-tokens';

type HeroProps = {
  intent: VisualIntent;
  width: number;
  queryTags?: readonly string[];
  onResolvedDev?: (info: { assetId: string; provider: string; localModule: string }) => void;
};

/** Single hero illustration from semantic selection. */
export function EditorialHeroComposition({ intent, width, queryTags, onResolvedDev }: HeroProps) {
  const selection = useMemo(
    () => selectVisualAsset({ intent, role: 'hero', composition: 'path-progress', queryTags }),
    [intent, queryTags]
  );

  React.useEffect(() => {
    onResolvedDev?.({
      assetId: selection.asset.id,
      provider: selection.asset.provider,
      localModule: selection.asset.localModule,
    });
    if (__DEV__) {
      console.log('[editorial-visual]', selection.asset.id, selection.reason, selection.asset.localModule);
    }
  }, [onResolvedDev, selection]);

  return (
    <EditorialIllustrationRenderer asset={selection.asset} width={width} height={width} />
  );
}

type EnemyBlock = {
  title: string;
  body: string;
};

type EnemiesProps = {
  items: readonly EnemyBlock[];
  width: number;
  /** Full-viewport step height (area under sticky title). */
  stepHeight?: number;
};

const ENEMY_INTENTS: readonly VisualIntent[] = [
  'procrastination',
  'perfectionism',
  'overplanning',
];

const ENEMY_ART_PAD = 16;
const ENEMY_OPTICAL_SCALE: Record<string, number> = {
  procrastination: 1.03,
  target: 1.28,
  schedule: 1.0,
};

/** Badge + title + body + gaps reserved inside each step. */
const ENEMY_TEXT_CHROME = 22 + 8 + 26 + 8 + 48 + 24;

function artSlotForStep(stepHeight: number, contentWidth: number): number {
  if (stepHeight <= 0) return 240;
  const fromHeight = stepHeight - ENEMY_TEXT_CHROME;
  return Math.round(Math.min(300, Math.max(220, fromHeight * 0.72), contentWidth * 0.78));
}

/**
 * One enemy per nearly full viewport step. Scroll pages 1 → 2 → 3.
 */
export function EditorialEnemiesComposition({ items, width, stepHeight = 0 }: EnemiesProps) {
  const picks = useMemo(
    () => selectVisualAssetsForIntents(ENEMY_INTENTS, 'metaphor', 'vertical-blocks'),
    []
  );
  const artSlot = artSlotForStep(stepHeight, width);
  const paint = artSlot - ENEMY_ART_PAD * 2;

  return (
    <View style={styles.enemyRoot}>
      {picks.map((pick, i) => {
        const item = items[i];
        if (!item) return null;
        const scale = ENEMY_OPTICAL_SCALE[pick.asset.localModule] ?? 1;
        return (
          <View
            key={pick.asset.id}
            style={[styles.enemyBlock, stepHeight > 0 ? { minHeight: stepHeight } : null]}
          >
            <View style={[styles.enemyArtSlot, { width: artSlot, height: artSlot }]}>
              <View style={{ transform: [{ scale }] }}>
                <EditorialIllustrationRenderer asset={pick.asset} width={paint} height={paint} />
              </View>
            </View>
            <View style={styles.enemyNum}>
              <Text style={styles.enemyNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.enemyTitle}>{item.title}</Text>
            <Text style={styles.enemyBody}>{item.body}</Text>
          </View>
        );
      })}
    </View>
  );
}

type StripProps = {
  width: number;
  height?: number;
  vertical?: boolean;
  labels?: readonly { title: string; subtitle: string }[];
  /** Full-viewport step height for each beat. */
  stepHeight?: number;
};

const STRIP_INTENTS: readonly VisualIntent[] = ['choice', 'hard-test', 'ego-protection'];

const DEFAULT_STRIP_LABELS = [
  { title: 'Elección', subtitle: 'opción dañina' },
  { title: 'Prueba', subtitle: 'difícil de pasar' },
  { title: 'Excusa', subtitle: 'salva la imagen' },
] as const;

const EXP_ART_PAD = 14;
const EXP_TEXT_CHROME = 16 + 10 + 16 + 4 + 20 + 36;

function expArtSlotForStep(stepHeight: number, contentWidth: number): number {
  if (stepHeight <= 0) return 240;
  const fromHeight = stepHeight - EXP_TEXT_CHROME;
  return Math.round(Math.min(300, Math.max(220, fromHeight * 0.7), contentWidth * 0.78));
}

/** Causal strip: one beat per viewport step, arrows on a clear vertical axis. */
export function EditorialCausalStripComposition({
  width,
  vertical: _vertical = true,
  labels,
  stepHeight = 0,
}: StripProps) {
  const picks = useMemo(
    () => selectVisualAssetsForIntents(STRIP_INTENTS, 'metaphor', 'causal-strip'),
    []
  );
  const labs = labels ?? DEFAULT_STRIP_LABELS;
  const artSlot = expArtSlotForStep(stepHeight, width);
  const paint = artSlot - EXP_ART_PAD * 2;

  return (
    <View style={styles.stripRootVertical}>
      {picks.map((pick, i) => (
        <View
          key={pick.asset.id}
          style={[styles.stripStepVertical, stepHeight > 0 ? { minHeight: stepHeight } : null]}
        >
          <View style={[styles.expArtSlot, { width: artSlot, height: artSlot }]}>
            <EditorialIllustrationRenderer asset={pick.asset} width={paint} height={paint} />
          </View>
          <Text style={styles.stripTitle}>{labs[i]?.title}</Text>
          <Text style={styles.stripSub}>{labs[i]?.subtitle}</Text>
          {i < picks.length - 1 ? (
            <View style={styles.arrowSlotVertical}>
              <ConnectorArrow down />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ConnectorArrow({ down = false }: { down?: boolean }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: motion.page.duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [bob]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: down ? bob.value * 7 : bob.value * 5 }],
  }));

  if (down) {
    return (
      <Animated.View style={motionStyle} accessibilityElementsHidden>
        <Svg width={14} height={20} viewBox="0 0 14 22">
          <Path
            d="M7 1v17M2 13l5 6 5-6"
            stroke={EDITORIAL_TEXT}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={motionStyle} accessibilityElementsHidden>
      <Svg width={20} height={14} viewBox="0 0 22 14">
        <Path
          d="M1 7h17M13 2l6 5-6 5"
          stroke={EDITORIAL_TEXT}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  enemyRoot: {
    alignSelf: 'stretch',
  },
  enemyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  enemyArtSlot: {
    padding: ENEMY_ART_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'visible',
  },
  enemyNum: {
    width: 24,
    height: 24,
    borderRadius: RADII.sm,
    backgroundColor: EDITORIAL_GRAPHIC_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  enemyNumText: {
    color: EDITORIAL_TEXT,
    ...typography('labelExtrabold'),
  },
  enemyTitle: {
    color: EDITORIAL_TEXT,
    ...typography('pageTitle'),
    textAlign: 'center',
  },
  enemyBody: {
    color: EDITORIAL_TEXT_MUTED,
    ...typography('title'),
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  stripRootVertical: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  stripStepVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  expArtSlot: {
    padding: EXP_ART_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  stripTitle: {
    marginTop: 14,
    color: EDITORIAL_TEXT,
    ...typography('stripTitle'),
    textAlign: 'center',
  },
  stripSub: {
    color: EDITORIAL_TEXT_MUTED,
    ...typography('body'),
    textAlign: 'center',
    marginTop: 4,
  },
  arrowSlotVertical: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
});
