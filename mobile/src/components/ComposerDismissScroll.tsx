import React from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

type ComposerDismissScrollProps = {
  children: React.ReactNode;
};

/**
 * Fixed composer + iOS interactive keyboard dismiss.
 * scrollEnabled=false keeps the dock pinned; alwaysBounceVertical lets UIKit track the swipe.
 */
export default function ComposerDismissScroll({ children }: ComposerDismissScrollProps) {
  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={styles.content}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={false}
      alwaysBounceVertical={Platform.OS === 'ios'}
      bounces={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      {...(Platform.OS === 'ios' ? { clipsToBounds: false } : null)}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexGrow: 0,
    overflow: 'visible',
  },
  content: {
    flexGrow: 0,
    overflow: 'visible',
  },
});
