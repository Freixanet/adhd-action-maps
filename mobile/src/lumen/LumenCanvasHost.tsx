import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Canvas } from '@shared/lumen/types';
import ExplainCanvasView from './ExplainCanvasView';
import CompareCanvasView from './CompareCanvasView';
import RecipeCanvasView from './RecipeCanvasView';
import PlanCanvasView from './PlanCanvasView';
import CollectionCanvasView from './CollectionCanvasView';
import GuideCanvasView from './GuideCanvasView';

type Props = {
  canvas: Canvas;
  onTabChange?: () => void;
};

export default function LumenCanvasHost({ canvas, onTabChange }: Props) {
  return (
    <View style={styles.wrap}>
      {canvas.kind === 'explain' ? <ExplainCanvasView doc={canvas} onTabChange={onTabChange} /> : null}
      {canvas.kind === 'compare' ? <CompareCanvasView doc={canvas} /> : null}
      {canvas.kind === 'recipe' ? <RecipeCanvasView doc={canvas} /> : null}
      {canvas.kind === 'plan' ? <PlanCanvasView doc={canvas} /> : null}
      {canvas.kind === 'collection' ? <CollectionCanvasView doc={canvas} /> : null}
      {canvas.kind === 'guide' ? <GuideCanvasView doc={canvas} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexGrow: 1,
  },
});
