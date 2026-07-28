import React from 'react';
import { Text, View } from 'react-native';
import type { StepContentBlock } from '../logic/contracts';
import BlockReferences from './BlockReferences';
import StatBlock from './blocks/StatBlock';
import ComparisonBlock from './blocks/ComparisonBlock';
import AccordionBlock from './blocks/AccordionBlock';
import QuizBlock from './blocks/QuizBlock';
import CalloutBlock from './blocks/CalloutBlock';

type StepContentBlocksProps = {
  blocks: StepContentBlock[];
};

function renderBlock(block: StepContentBlock, idx: number) {
  switch (block.type) {
    case 'stat':
      return <StatBlock key={`stat-${idx}`} block={block} index={idx} />;
    case 'comparison':
      return <ComparisonBlock key={`comparison-${idx}`} block={block} index={idx} />;
    case 'accordion':
      return <AccordionBlock key={`accordion-${idx}`} block={block} index={idx} />;
    case 'quiz':
      return <QuizBlock key={`quiz-${idx}`} block={block} index={idx} />;
    case 'callout':
      return (
        <CalloutBlock
          key={`callout-${idx}`}
          label={block.label}
          text={block.text || ''}
          kind={block.kind}
          references={block.references}
          index={idx}
        />
      );
    case 'list':
      return (
        <View key={idx} className="my-6">
          {block.text ? (
            <Text className="text-[17px] leading-[26px] text-body mb-4">{block.text}</Text>
          ) : null}
          {block.items?.map((item, i) => (
            <View key={i} className="flex-row gap-3 items-start mb-4">
              <View className="w-1.5 h-1.5 rounded-full bg-secondary/70 mt-2.5 shrink-0" />
              <Text className="flex-1 text-[17px] leading-[26px] text-body">
                <Text className="font-bold text-primary">{item.strong}</Text>
                {item.span ? <Text className="text-body"> {item.span}</Text> : null}
              </Text>
            </View>
          ))}
          <BlockReferences references={block.references} />
        </View>
      );
    case 'prose':
    default: {
      const textContent = block.type === 'prose' ? block.text : '';
      if (!textContent.trim()) return null;
      return (
        <View key={idx} className="my-4">
          <Text className="text-[17px] leading-[26px] text-body">{textContent}</Text>
          <BlockReferences references={block.references} />
        </View>
      );
    }
  }
}

export default function StepContentBlocks({ blocks }: StepContentBlocksProps) {
  if (!blocks.length) return null;

  return <View>{blocks.map((block, idx) => renderBlock(block, idx))}</View>;
}
