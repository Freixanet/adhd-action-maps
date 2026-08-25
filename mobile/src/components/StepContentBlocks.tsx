import React from 'react';
import { View } from 'react-native';
import type { StepContentBlock } from '../logic/contracts';
import BlockReferences from './BlockReferences';
import StatBlock from './blocks/StatBlock';
import ComparisonBlock from './blocks/ComparisonBlock';
import AccordionBlock from './blocks/AccordionBlock';
import QuizBlock from './blocks/QuizBlock';
import CalloutBlock from './blocks/CalloutBlock';
import { color } from '@shared/design-tokens';
import { NucleoText, ReadingText } from '../context/TypographyContext';

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
            <ReadingText className="mb-4" typeRole="readingBody">{block.text}</ReadingText>
          ) : null}
          {block.items?.map((item, i) => (
            <View key={i} className="flex-row gap-3 items-start mb-4">
              <View className="w-1.5 h-1.5 rounded-full bg-secondary/70 mt-2.5 shrink-0" />
              <ReadingText className="flex-1" typeRole="readingBody">
                <NucleoText typeRole="readingBodyStrong" style={{ color: color.text.primary }}>{item.strong}</NucleoText>
                {item.span ? <NucleoText typeRole="readingBody"> {item.span}</NucleoText> : null}
              </ReadingText>
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
          <ReadingText typeRole="readingBody">{textContent}</ReadingText>
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
