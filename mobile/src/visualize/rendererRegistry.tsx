import React from 'react';
import { Text, View } from 'react-native';
import type { RenderSpec } from '@shared/visualize';
import { TEXT_SECONDARY } from '@shared/uiTokens';
import CausalChainRenderer from './renderers/CausalChainRenderer';
import GuidedReadingRenderer from './renderers/GuidedReadingRenderer';

type Props = {
  spec: RenderSpec;
};

/**
 * Deterministic dispatch: RenderSpec.type → RN component.
 * Server never sends HTML; unknown types fail closed.
 */
export default function VisualizeRendererRegistry({ spec }: Props) {
  switch (spec.type) {
    case 'causal-chain':
      return <CausalChainRenderer spec={spec} />;
    case 'guided-reading':
      return <GuidedReadingRenderer spec={spec} />;
    default: {
      const _exhaustive: never = spec;
      return (
        <View>
          <Text style={{ color: TEXT_SECONDARY }}>
            Renderer no disponible ({String((_exhaustive as RenderSpec).type)})
          </Text>
        </View>
      );
    }
  }
}
