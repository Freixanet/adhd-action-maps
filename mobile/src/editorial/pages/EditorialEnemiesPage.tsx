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
import {
  EDITORIAL_SHEET_BG,
  EDITORIAL_TEXT,
  EDITORIAL_TEXT_BODY,
  EDITORIAL_TEXT_OCHRE,
} from '@shared/editorial/colors';
import { editorialContentWidth } from '@shared/editorial/space';
import { EditorialEnemiesComposition } from '../visuals/EditorialComposition';
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

export default function EditorialEnemiesPage({ page, onContentCompleteChange }: Props) {
  const { width: screenW } = useWindowDimensions();
  const contentW = editorialContentWidth(screenW);
  const [headerH, setHeaderH] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const completeRef = useRef(false);

  const items = useMemo(
    () =>
      (page.items?.slice(0, 3) ?? []).map((item) => ({
        title: item.title,
        body: item.body,
      })),
    [page.items]
  );

  /** One step fills the area under the sticky title/lede. */
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
        <EditorialEnemiesComposition
          items={items}
          width={contentW}
          stepHeight={stepHeight}
        />
      </ScrollView>

      <View
        style={styles.stickyHeader}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - headerH) > 1) setHeaderH(h);
        }}
      >
        {page.kicker ? <Text style={styles.kicker}>{page.kicker}</Text> : null}
        <Text style={styles.title}>{page.title}</Text>
        {page.body ? <Text style={styles.lede}>{page.body}</Text> : null}
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
  kicker: {
    color: EDITORIAL_TEXT_OCHRE,
    ...typography('metaWide'),
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: EDITORIAL_TEXT,
    ...typography('editorialSectionTitle'),
  },
  lede: {
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
});
