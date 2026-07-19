import React, { ReactNode } from 'react';
import { Text, TextProps } from 'react-native';

type BalancedTextProps = TextProps & {
  children: ReactNode;
};

export default function BalancedText({ children, ...props }: BalancedTextProps) {
  return <Text {...props}>{children}</Text>;
}
