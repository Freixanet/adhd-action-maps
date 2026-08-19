import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EditorialPage } from '@shared/editorial';
import { RADII } from '@shared/uiTokens';
import {
  EDITORIAL_GRAPHIC_YELLOW,
  EDITORIAL_PHRASE_BG,
  EDITORIAL_TEXT,
  EDITORIAL_TEXT_BODY,
  EDITORIAL_TEXT_OCHRE,
  EDITORIAL_YELLOW_BORDER,
} from '@shared/editorial/colors';
import { EDITORIAL_SPACE, editorialContentWidth } from '@shared/editorial/space';
import { EditorialHeroComposition } from '../visuals/EditorialComposition';
import { color, type, space, typography, radius } from '@shared/design-tokens';

type Props = {
  page: EditorialPage;
  nucleusClaim?: string;
  topic?: 'procrastination' | 'attention';
};

/** Approved mockup hero size. */
const HERO_SIZE = 300;

export default function EditorialCoverPage({ page, nucleusClaim }: Props) {
  const { width: screenW } = useWindowDimensions();
  const contentW = editorialContentWidth(screenW);
  const heroSize = Math.min(HERO_SIZE, Math.round(contentW * 0.9));
  const claim = page.callout?.body ?? nucleusClaim ?? '';

  return (
    <View style={styles.root}>
      <View style={styles.copyBlock}>
        <CoverTitle
          title={page.title}
          emphasis={page.titleEmphasis}
          lines={page.titleLines}
        />
        {page.body ? <Text style={styles.subtitle}>{page.body}</Text> : null}
      </View>

      <View style={styles.heroStage}>
        <EditorialHeroComposition
          intent="progress-toward-goal"
          width={heroSize}
          queryTags={page.illustration?.searchTags}
        />
      </View>

      <View style={styles.claimCard}>
        <Text style={styles.claimKicker}>{page.callout?.title ?? 'En una frase'}</Text>
        <Text style={styles.claimBody}>{claim}</Text>
      </View>
    </View>
  );
}

/**
 * Underline comes from `titleEmphasis` (planner/LLM).
 * Deliberate lines come from `titleLines` when provided.
 */
function CoverTitle({
  title,
  emphasis,
  lines,
}: {
  title: string;
  emphasis?: string;
  lines?: string[];
}) {
  const rows = lines && lines.length > 0 ? lines : [title];

  return (
    <View style={styles.titleBlock} accessibilityRole="header">
      {rows.map((line, i) => (
        <TitleLine key={`${line}-${i}`} line={line} emphasis={emphasis} />
      ))}
    </View>
  );
}

function TitleLine({ line, emphasis }: { line: string; emphasis?: string }) {
  const parts = splitTitleEmphasis(line, emphasis);
  if (!parts) {
    return <Text style={styles.title}>{line}</Text>;
  }

  return (
    <View style={styles.titleRow}>
      {parts.before ? <Text style={styles.title}>{parts.before}</Text> : null}
      <View style={styles.emWord}>
        <Text style={styles.title}>
          {parts.word}
          {parts.after}
        </Text>
        <View style={styles.emBar} />
      </View>
    </View>
  );
}

function splitTitleEmphasis(
  title: string,
  emphasis?: string
): { before: string; word: string; after: string } | null {
  const needle = emphasis?.trim();
  if (!needle) return null;
  const idx = title.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return null;
  return {
    before: title.slice(0, idx),
    word: title.slice(idx, idx + needle.length),
    after: title.slice(idx + needle.length),
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  copyBlock: {
    gap: 10,
  },
  titleBlock: {
    alignSelf: 'stretch',
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  emWord: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  title: {
    color: EDITORIAL_TEXT,
    ...typography('editorialCoverTitle'),
  },
  emBar: {
    height: 4,
    marginTop: 1,
    borderRadius: radius.hairline,
    backgroundColor: EDITORIAL_GRAPHIC_YELLOW,
  },
  subtitle: {
    color: EDITORIAL_TEXT_BODY,
    ...typography('title'),
  },
  heroStage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 14,
    minHeight: 220,
    overflow: 'visible',
  },
  claimCard: {
    backgroundColor: EDITORIAL_PHRASE_BG,
    borderColor: EDITORIAL_YELLOW_BORDER,
    borderWidth: 1,
    borderRadius: RADII.md,
    padding: EDITORIAL_SPACE.cardPadding,
    gap: EDITORIAL_SPACE.titleToBody,
  },
  claimKicker: {
    color: EDITORIAL_TEXT_OCHRE,
    ...typography('metaWide'),
    textTransform: 'uppercase',
  },
  claimBody: {
    color: EDITORIAL_TEXT,
    ...typography('title'),
  },
});
