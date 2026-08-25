import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { EditorialPage } from '@shared/editorial';
import EditorialCoverPage from './pages/EditorialCoverPage';
import EditorialEnemiesPage from './pages/EditorialEnemiesPage';
import EditorialExperimentPage from './pages/EditorialExperimentPage';

type Props = {
  page: EditorialPage;
  nucleusClaim?: string;
  topic?: 'procrastination' | 'attention';
  /** Scrollable pages report when the user reaches the last scroll position. */
  onContentCompleteChange?: (complete: boolean) => void;
};

/**
 * Archetype → dedicated composition. Topic selects semantic visual intents.
 */
export default function EditorialPageView({
  page,
  nucleusClaim,
  topic = 'procrastination',
  onContentCompleteChange,
}: Props) {
  let content: React.ReactNode;
  switch (page.archetype) {
    case 'cover':
      content = <EditorialCoverPage page={page} nucleusClaim={nucleusClaim} topic={topic} />;
      break;
    case 'comparison':
      content = (
        <EditorialEnemiesPage
          page={page}
          topic={topic}
          onContentCompleteChange={onContentCompleteChange}
        />
      );
      break;
    case 'experiment':
      content = (
        <EditorialExperimentPage
          page={page}
          topic={topic}
          onContentCompleteChange={onContentCompleteChange}
        />
      );
      break;
    default:
      content = (
        <EditorialEnemiesPage
          page={page}
          topic={topic}
          onContentCompleteChange={onContentCompleteChange}
        />
      );
  }
  return <View style={styles.fill}>{content}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
