import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EDITORIAL_SHEET_BG, EDITORIAL_TEXT, EDITORIAL_TEXT_MUTED } from '@shared/editorial/colors';
import { useAppSession } from '../context/AppSessionContext';
import EditorialPlanHost from '../editorial/EditorialPlanHost';
import { RADII } from '@shared/uiTokens';
import { color, type, typography } from '@shared/design-tokens';

class EditorialErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; stack: string }
> {
  state = { error: null as Error | null, stack: '' };

  static getDerivedStateFromError(error: Error) {
    return { error, stack: error.stack ?? '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[editorial-demo] render crash', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error editorial</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
          <Text style={styles.errorStack}>{this.state.stack.slice(0, 1200)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * Demo shell: safe area + PlanHost (owns reserved header + nav).
 */
export default function EditorialDemoScreen() {
  const session = useAppSession();
  const plan = session.editorialDemoPlan;

  if (!plan) return null;

  return (
    <View style={styles.bleed}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <EditorialErrorBoundary>
          <EditorialPlanHost plan={plan} onClose={session.closeEditorialDemo} />
        </EditorialErrorBoundary>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: {
    flex: 1,
    backgroundColor: EDITORIAL_SHEET_BG,
  },
  root: {
    flex: 1,
    backgroundColor: EDITORIAL_SHEET_BG,
  },
  errorBox: {
    backgroundColor: color.background.editorialDemoWash,
    borderRadius: RADII.md,
    padding: 16,
    gap: 8,
    margin: 16,
  },
  errorTitle: {
    color: color.background.editorialDemoAccent,
    ...typography('titleExtrabold'),
  },
  errorBody: {
    color: EDITORIAL_TEXT,
    fontSize: type.callout.fontSize,
  },
  errorStack: {
    color: EDITORIAL_TEXT_MUTED,
    ...typography('meta'),
  },
});
