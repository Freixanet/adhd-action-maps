import React from 'react';
import { Text } from 'react-native';

type MapCategoryLabelProps = {
  category: string;
  size?: 'sm' | 'md';
};

export default function MapCategoryLabel({ category, size = 'sm' }: MapCategoryLabelProps) {
  const textClass =
    size === 'md'
      ? 'text-[13px] font-medium tracking-wide text-body'
      : 'text-[11px] font-medium uppercase tracking-[0.14em] text-secondary';

  return (
    <Text className={textClass} numberOfLines={1}>
      {category}
    </Text>
  );
}
