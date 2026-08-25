import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SourceReference } from '../logic/contracts';
import { useSourceViewer } from '../context/SourceViewerContext';
import { type } from '@shared/design-tokens';

/**
 * Citation / reference pills under a content block.
 * A chunkId proves addressing (can open the fragment when citedChunks has exact text).
 * It is NOT automatically verified evidence — S05 EvidenceLink + verifierStatus decide that.
 */
export default function BlockReferences({ references }: { references?: SourceReference[] }) {
  const { openCitation } = useSourceViewer();
  if (!references?.length) return null;

  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {references.slice(0, 4).map((reference, idx) => {
        const chunkId = reference.chunkId?.trim();

        if (chunkId) {
          return (
            <Pressable
              key={`${chunkId}-${idx}`}
              onPress={() => {
                openCitation(chunkId, reference);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Ver fuente ${reference.label}`}
              className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 active:opacity-80"
            >
              <Text className="text-meta font-medium text-body" numberOfLines={1}>
                [{reference.label}]
              </Text>
            </Pressable>
          );
        }

        return (
          <View
            key={`${reference.label}-${reference.locator}-${idx}`}
            className="rounded-full border border-white/12 px-2.5 py-1"
          >
            <Text className="text-meta font-medium text-body" numberOfLines={1}>
              <Text className="text-secondary">{reference.label} </Text>
              {reference.locator}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
