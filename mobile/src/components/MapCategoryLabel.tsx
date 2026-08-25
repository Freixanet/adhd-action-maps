import React from 'react';
import { Text } from 'react-native';
import { type } from '@shared/design-tokens';

type MapCategoryLabelProps = {
  category: string;
  size?: 'sm' | 'md';
};

export default function MapCategoryLabel({ category, size = 'sm' }: MapCategoryLabelProps) {
  const textClass =
    size === 'md'
      ? 'text-label font-medium tracking-wide text-body'
      : 'text-meta font-medium uppercase text-secondary';

  return (
    <Text className={textClass} numberOfLines={1}>
      {category}
    </Text>
  );
}
