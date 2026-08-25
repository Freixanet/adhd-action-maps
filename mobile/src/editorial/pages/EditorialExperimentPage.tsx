import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { EditorialPage } from '@shared/editorial';
import { RADII } from '@shared/uiTokens';
import {
  EDITORIAL_CALLOUT_DARK,
  EDITORIAL_CALLOUT_DARK_TEXT,
  EDITORIAL_GRAPHIC_YELLOW,
  EDITORIAL_SHEET_BG,
  EDITORIAL_TEXT,
  EDITORIAL_TEXT_BODY,
  EDITORIAL_TEXT_MUTED,
} from '@shared/editorial/colors';
import { EDITORIAL_SPACE, editorialContentWidth } from '@shared/editorial/space';
import { EditorialCausalStripComposition } from '../visuals/EditorialComposition';
import { color, type, space, typography } from '@shared/design-tokens';
import {
  EDITORIAL_SCROLL_BOTTOM_INSET,
  isEditorialScrollNearEnd,
} from '../editorialChrome';

type Props = {
  page: EditorialPage;
  topic?: 'procrastination' | 'attention';
  onContentCompleteChange?: (complete: boolean) => void;
};

export default function EditorialExperimentPage({ page, onContentCompleteChange }: Props) {
  const { width: screenW } = useWindowDimensions();
  const stripW = editorialContentWidth(screenW);
  const [headerH, setHeaderH] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const completeRef = useRef(false);

  const sequenceLabels = useMemo(
    () =>
      page.items && page.items.length >= 3
        ? page.items.slice(0, 3).map((item) => ({
            title: item.title,
            subtitle: item.body,
          }))
        : undefined,
    [page.items]
  );

  /** One beat fills the area under the sticky title/lede. */
  const stepHeight =
    viewportH > 0 && headerH > 0 ? Math.max(360, Math.round(viewportH - headerH)) : 0;

  const reportComplete = useCallback(
    (complete: boolean) => {
      if (completeRef.current === complete) return;
      completeRef.current = complete;
      onContentCompleteChange?.(complete);
    },
    [onContentCompleteChange]
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      reportComplete(isEditorialScrollNearEnd(e.nativeEvent));
    },
    [reportComplete]
  );

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - viewportH) > 1) setViewportH(h);
      }}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          headerH > 0 ? { paddingTop: headerH } : null,
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        snapToInterval={stepHeight > 0 ? stepHeight : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        <EditorialCausalStripComposition
          width={stripW}
          vertical
          labels={sequenceLabels}
          stepHeight={stepHeight}
        />

        <View style={[styles.conclusionStep, stepHeight > 0 ? { minHeight: stepHeight } : null]}>
          {page.callout ? (
            <View style={styles.conclusion}>
              {page.callout.title ? (
                <Text style={styles.conclusionKicker}>{page.callout.title}</Text>
              ) : null}
              <Text style={styles.conclusionBody}>{page.callout.body}</Text>
            </View>
          ) : null}
          <Text style={styles.ref}>Berglas & Jones (1978)</Text>
        </View>
      </ScrollView>

      <View
        style={styles.stickyHeader}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - headerH) > 1) setHeaderH(h);
        }}
      >
        <Text style={styles.title}>{page.title}</Text>
        {page.body ? <Text style={styles.body}>{page.body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 0,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: EDITORIAL_SHEET_BG,
    paddingBottom: 8,
  },
  title: {
    color: EDITORIAL_TEXT,
    ...typography('editorialSectionTitle'),
  },
  body: {
    color: EDITORIAL_TEXT_BODY,
    ...typography('title'),
    marginTop: 10,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: EDITORIAL_SCROLL_BOTTOM_INSET,
  },
  conclusionStep: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  conclusion: {
    backgroundColor: EDITORIAL_CALLOUT_DARK,
    borderRadius: RADII.md,
    padding: EDITORIAL_SPACE.cardPadding,
    gap: EDITORIAL_SPACE.titleToBody,
    marginBottom: EDITORIAL_SPACE.titleToBody,
  },
  conclusionKicker: {
    color: EDITORIAL_GRAPHIC_YELLOW,
    ...typography('metaWide'),
    textTransform: 'uppercase',
  },
  conclusionBody: {
    color: EDITORIAL_CALLOUT_DARK_TEXT,
    ...typography('title'),
  },
  ref: {
    color: EDITORIAL_TEXT_MUTED,
    ...typography('meta'),
    textAlign: 'center',
    marginBottom: 8,
  },
});
