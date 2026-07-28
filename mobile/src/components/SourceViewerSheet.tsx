import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import { citationHeaderFromLoc } from '@shared/citationLabels';
import GlassSurface from './GlassSurface';
import { stepHaptic } from '../context/AppSessionContext';
import { useSourceViewer } from '../context/SourceViewerContext';

/**
 * Bottom sheet showing the exact SourceChunk text for a tapped citation.
 */
export default function SourceViewerSheet() {
  const { target, close } = useSourceViewer();
  const visible = Boolean(target);

  const header = useMemo(() => {
    if (!target) return '';
    const locLabel = citationHeaderFromLoc(target.chunk.loc);
    const title = target.sourceTitle?.trim();
    return title ? `${locLabel} · ${title}` : locLabel;
  }, [target]);

  const quote = target?.reference?.excerpt?.trim() || '';
  const body = target?.chunk.text ?? '';
  const quoteIndex =
    quote && body ? body.toLowerCase().indexOf(quote.toLowerCase()) : -1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface liquid borderRadius={RADII.lg} style={styles.sheet}>
            <View className="px-5 pt-5 pb-2">
              <Text className="text-[13px] font-bold uppercase tracking-widest text-secondary">
                fuente
              </Text>
              <Text className="mt-2 text-[20px] font-extrabold leading-7 text-primary" numberOfLines={3}>
                {header}
              </Text>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {quoteIndex >= 0 ? (
                <Text className="text-[16px] leading-6 text-body">
                  {body.slice(0, quoteIndex)}
                  <Text className="text-primary font-semibold bg-accent/20">
                    {body.slice(quoteIndex, quoteIndex + quote.length)}
                  </Text>
                  {body.slice(quoteIndex + quote.length)}
                </Text>
              ) : (
                <Text className="text-[16px] leading-6 text-body">{body}</Text>
              )}
            </ScrollView>
            <View className="px-5 pb-5 pt-2">
              <Pressable
                onPress={() => {
                  stepHaptic();
                  close();
                }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                className="items-center py-3"
              >
                <Text className="text-[15px] text-secondary">Cerrar</Text>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetHost: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    maxHeight: '78%',
  },
  sheet: {
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
});
