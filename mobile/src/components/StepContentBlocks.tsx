import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SEM_ALERTA, SEM_CLAVE, SEM_EJEMPLO, SEM_MATIZ } from '@shared/uiTokens';
import type { StepContentBlock } from '../logic/contracts';

type SemTone = 'clave' | 'matiz' | 'ejemplo' | 'alerta';

const TONE_COLOR: Record<SemTone, string> = {
  clave: SEM_CLAVE,
  matiz: SEM_MATIZ,
  ejemplo: SEM_EJEMPLO,
  alerta: SEM_ALERTA,
};

const TONE_LABEL: Record<SemTone, string> = {
  clave: 'Idea clave',
  matiz: 'Matiz',
  ejemplo: 'Ejemplo',
  alerta: 'Límite',
};

const KIND_TO_TONE: Record<string, SemTone> = {
  clave: 'clave',
  matiz: 'matiz',
  ejemplo: 'ejemplo',
  alerta: 'alerta',
  info: 'clave',
  action: 'ejemplo',
  alert: 'alerta',
};

type StepContentBlocksProps = {
  blocks: StepContentBlock[];
};

function BlockReferences({ references }: { references?: StepContentBlock['references'] }) {
  if (!references?.length) return null;

  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {references.slice(0, 3).map((reference, idx) => (
        <View
          key={`${reference.label}-${reference.locator}-${idx}`}
          className="rounded-full border border-neutral-300 dark:border-white/12 px-2.5 py-1"
        >
          <Text className="text-[11px] font-medium text-body">
            <Text className="text-secondary">{reference.label} </Text>
            {reference.locator}
          </Text>
        </View>
      ))}
    </View>
  );
}

function renderBlock(block: StepContentBlock, idx: number) {
  const type = String(block.type || 'prose').toLowerCase();
  const textContent = block.text || '';

  if (type === 'callout') {
    const kind = String(block.kind || 'info').toLowerCase();
    const tone = KIND_TO_TONE[kind] ?? 'clave';
    const color = TONE_COLOR[tone];
    const label = String(block.label || TONE_LABEL[tone]);

    return (
      <View key={idx} className="my-6 rounded-card overflow-hidden">
        <View className="bg-surface p-4">
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.05 }]}
          />
          <Text
            className="text-[13px] font-semibold uppercase tracking-[0.08em]"
            style={{ color }}
          >
            {label}
          </Text>
          {textContent ? (
            <Text className="mt-2 text-[17px] leading-[26px] text-body">{textContent}</Text>
          ) : null}
          <BlockReferences references={block.references} />
        </View>
      </View>
    );
  }

  if (type === 'list') {
    return (
      <View key={idx} className="my-6">
        {textContent ? (
          <Text className="text-[17px] leading-[26px] text-body mb-4">{textContent}</Text>
        ) : null}
        {block.items?.map((item, i) => (
          <View key={i} className="flex-row gap-3 items-start mb-4">
            <View className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
            <Text className="flex-1 text-[17px] leading-[26px] text-body">
              <Text className="font-bold text-primary">{item.strong}</Text>
              {item.span ? <Text className="text-body"> {item.span}</Text> : null}
            </Text>
          </View>
        ))}
        <BlockReferences references={block.references} />
      </View>
    );
  }

  if (!textContent.trim()) return null;

  return (
    <View key={idx} className="my-4">
      <Text className="text-[17px] leading-[26px] text-body">{textContent}</Text>
      <BlockReferences references={block.references} />
    </View>
  );
}

export default function StepContentBlocks({ blocks }: StepContentBlocksProps) {
  if (!blocks.length) return null;

  return <View>{blocks.map((block, idx) => renderBlock(block, idx))}</View>;
}
