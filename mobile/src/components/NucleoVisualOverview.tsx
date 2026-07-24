import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';
import {
  ACCENT,
  TEXT_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VIZ_GRID,
  VIZ_MUTED,
  VIZ_SERIES,
} from '@shared/uiTokens';
import { getVisualGeometry, type VisualNodeFrame } from '@shared/nucleoVisualGeometry';
import type {
  NucleoVisualItem,
  NucleoVisualLink,
  NucleoVisualSpec,
} from '../logic/contracts';
import { stepHaptic } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';

type NucleoVisualOverviewProps = {
  visual: NucleoVisualSpec;
  compact?: boolean;
  showTitle?: boolean;
  onOpenStep?: (stepId: string) => void;
};

type VisualRendererProps = {
  visual: NucleoVisualSpec;
  selectedId: string;
  onSelect: (id: string) => void;
  width: number;
  reduceMotion: boolean;
};

const DEFAULT_WIDTH = 320;
const MOTION_MS = 200;

function formatValue(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function itemAccessibilityLabel(item: NucleoVisualItem, visual: NucleoVisualSpec): string {
  const value = Number.isFinite(item.value)
    ? ` ${formatValue(item.value!, item.unit || visual.unit)}.`
    : '';
  return `${item.label}.${value} ${item.detail || ''}`.trim();
}

function AnimatedNode({
  item,
  visual,
  selected,
  onPress,
  frame,
  reduceMotion,
}: {
  item: NucleoVisualItem;
  visual: NucleoVisualSpec;
  selected: boolean;
  onPress: () => void;
  frame: VisualNodeFrame;
  reduceMotion: boolean;
}) {
  const selection = useSharedValue(selected ? 1 : 0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      selection.value = selected ? 1 : 0;
      mounted.current = true;
      return;
    }
    selection.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : MOTION_MS,
    });
  }, [reduceMotion, selected, selection]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + selection.value * 0.035 }],
  }));

  return (
    <Animated.View
      style={[
        styles.nodeFrame,
        { left: frame.x, top: frame.y, width: frame.width, height: frame.height },
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={itemAccessibilityLabel(item, visual)}
        accessibilityState={{ selected }}
        hitSlop={6}
        onPress={onPress}
        style={({ pressed }) => [
          styles.nodePressable,
          selected && styles.nodeSelected,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.nodeMarker, selected && styles.nodeMarkerSelected]} />
        <Text numberOfLines={3} style={[styles.nodeLabel, selected && styles.nodeLabelSelected]}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function arrowPath(from: VisualNodeFrame, to: VisualNodeFrame): string {
  const fromX = from.x + from.width / 2;
  const fromY = from.y + from.height / 2;
  const toX = to.x + to.width / 2;
  const toY = to.y + to.height / 2;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const tipX = toX - Math.cos(angle) * Math.min(to.width, to.height) * 0.48;
  const tipY = toY - Math.sin(angle) * Math.min(to.width, to.height) * 0.48;
  const size = 6;
  const leftX = tipX - Math.cos(angle - Math.PI / 5) * size;
  const leftY = tipY - Math.sin(angle - Math.PI / 5) * size;
  const rightX = tipX - Math.cos(angle + Math.PI / 5) * size;
  const rightY = tipY - Math.sin(angle + Math.PI / 5) * size;
  return `M ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY}`;
}

function ConnectorLayer({
  items,
  frames,
  links,
  arrow,
  width,
  height,
}: {
  items: NucleoVisualItem[];
  frames: VisualNodeFrame[];
  links: NucleoVisualLink[];
  arrow: boolean;
  width: number;
  height: number;
}) {
  const frameById = new Map(items.map((item, index) => [item.id, frames[index]]));
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {links.map((link) => {
        const source = frameById.get(link.source);
        const target = frameById.get(link.target);
        if (!source || !target) return null;
        const x1 = source.x + source.width / 2;
        const y1 = source.y + source.height / 2;
        const x2 = target.x + target.width / 2;
        const y2 = target.y + target.height / 2;
        return (
          <React.Fragment key={`${link.source}-${link.target}`}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ_MUTED} strokeWidth={1.5} />
            {arrow ? (
              <Path
                d={arrowPath(source, target)}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {link.label ? (
              <SvgText
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 5}
                fill={TEXT_SECONDARY}
                fontSize={9}
                textAnchor="middle"
              >
                {link.label}
              </SvgText>
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function DiagramVisual(props: VisualRendererProps) {
  const { visual, selectedId, onSelect, width, reduceMotion } = props;
  const geometry = useMemo(
    () => getVisualGeometry(visual.kind, width, visual.items.map((item) => item.label)),
    [visual.kind, visual.items, width]
  );
  const links = visual.links ?? [];

  return (
    <View style={{ width: geometry.width, height: geometry.height }}>
      <ConnectorLayer
        items={visual.items}
        frames={geometry.frames}
        links={links}
        arrow={visual.kind === 'flow' || visual.kind === 'cycle'}
        width={geometry.width}
        height={geometry.height}
      />
      {visual.items.map((item, index) => (
        <AnimatedNode
          key={item.id}
          item={item}
          visual={visual}
          selected={item.id === selectedId}
          onPress={() => onSelect(item.id)}
          frame={geometry.frames[index]}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

function ComparisonVisual({ visual, selectedId, onSelect }: VisualRendererProps) {
  const groups = useMemo(() => {
    return [...new Set(visual.items.map((item) => item.group || item.label))];
  }, [visual.items]);
  const dimensions = useMemo(
    () => [...new Set(visual.items.map((item) => item.label))],
    [visual.items]
  );

  return (
    <View style={styles.comparison}>
      <View style={styles.comparisonHeader}>
        {groups.map((group, groupIndex) => (
          <Text key={group} style={[styles.groupLabel, { color: VIZ_SERIES[groupIndex % VIZ_SERIES.length] }]}>
            {group}
          </Text>
        ))}
      </View>
      {dimensions.map((dimension) => (
        <View key={dimension} style={styles.comparisonRow}>
          <Text style={styles.comparisonDimension}>{dimension}</Text>
          <View style={styles.comparisonCells}>
            {groups.map((group, groupIndex) => {
              const item = visual.items.find(
                (candidate) => (candidate.group || candidate.label) === group && candidate.label === dimension
              );
              if (!item) {
                return <View key={group} style={styles.comparisonCell} />;
              }
              const selected = item.id === selectedId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={itemAccessibilityLabel(item, visual)}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => [
                    styles.comparisonCell,
                    groupIndex > 0 && styles.columnDivider,
                    selected && styles.comparisonCellSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  {Number.isFinite(item.value) ? (
                    <Text style={styles.comparisonValue}>
                      {formatValue(item.value!, item.unit || visual.unit)}
                    </Text>
                  ) : item.detail ? (
                    <Text style={[styles.comparisonDetail, selected && styles.nodeLabelSelected]}>
                      {item.detail}
                    </Text>
                  ) : (
                    <Text style={[styles.comparisonLabel, selected && styles.nodeLabelSelected]}>
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function BarVisual({ visual, selectedId, onSelect, width }: VisualRendererProps) {
  const values = visual.items.map((item) => item.value ?? 0);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const plotWidth = Math.max(120, width - 8);
  const zeroX = Math.min(plotWidth - 1, Math.max(0, ((0 - minimum) / range) * plotWidth));
  const groups = [...new Set(visual.items.map((item) => item.group || 'Serie'))];

  return (
    <View style={styles.barRoot}>
      {visual.yLabel ? <Text style={styles.axisTitle}>{visual.yLabel}</Text> : null}
      {visual.items.map((item) => {
        const value = item.value ?? 0;
        const valueX = ((value - minimum) / range) * plotWidth;
        const left = Math.min(zeroX, valueX);
        const barWidth = Math.max(2, Math.abs(valueX - zeroX));
        const groupIndex = Math.max(0, groups.indexOf(item.group || 'Serie'));
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={itemAccessibilityLabel(item, visual)}
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [styles.barRow, pressed && styles.pressed]}
          >
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLabel, selected && styles.nodeLabelSelected]}>
                {groups.length > 1 ? `${item.group || 'Serie'} · ${item.label}` : item.label}
              </Text>
              <Text style={[styles.barValue, { color: VIZ_SERIES[groupIndex % VIZ_SERIES.length] }]}>
                {formatValue(value, item.unit || visual.unit)}
              </Text>
            </View>
            <View style={[styles.barTrack, { width: plotWidth }]}>
              <View style={[styles.zeroLine, { left: zeroX }]} />
              <View
                style={[
                  styles.barMark,
                  {
                    left,
                    width: barWidth,
                    backgroundColor: VIZ_SERIES[groupIndex % VIZ_SERIES.length],
                    opacity: selected ? 1 : 0.68,
                  },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
      {visual.xLabel ? <Text style={styles.axisCaption}>{visual.xLabel}</Text> : null}
    </View>
  );
}

function LineVisual({ visual, selectedId, onSelect, width }: VisualRendererProps) {
  const labels = [...new Set(visual.items.map((item) => item.label))];
  const categoryRows = Math.ceil(labels.length / 2);
  const chartHeight = 202 + categoryRows * 23;
  const plotTop = 30;
  const plotBottom = 156;
  const plotLeft = 24;
  const plotRight = Math.max(plotLeft + 1, width - 24);
  const values = visual.items.map((item) => item.value ?? 0);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const groups = [...new Set(visual.items.map((item) => item.group || 'Serie'))];
  const pointFor = (item: NucleoVisualItem) => {
    const labelIndex = Math.max(0, labels.indexOf(item.label));
    const x = labels.length === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft + (labelIndex / (labels.length - 1)) * (plotRight - plotLeft);
    const y = plotBottom - (((item.value ?? 0) - minimum) / range) * (plotBottom - plotTop);
    return { x, y };
  };

  return (
    <View style={{ width, height: chartHeight }}>
      <Svg width={width} height={chartHeight} style={StyleSheet.absoluteFill}>
        <Line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke={VIZ_GRID} />
        <Line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke={VIZ_GRID} />
        {groups.map((group, groupIndex) => {
          const items = visual.items.filter((item) => (item.group || 'Serie') === group);
          const points = items.map(pointFor).map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <Polyline
              key={group}
              points={points}
              fill="none"
              stroke={VIZ_SERIES[groupIndex % VIZ_SERIES.length]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {visual.items.map((item) => {
          const point = pointFor(item);
          const groupIndex = Math.max(0, groups.indexOf(item.group || 'Serie'));
          const selected = item.id === selectedId;
          return (
            <React.Fragment key={item.id}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={selected ? 5 : 3.5}
                fill={VIZ_SERIES[groupIndex % VIZ_SERIES.length]}
                stroke={selected ? TEXT_PRIMARY : VIZ_SERIES[groupIndex % VIZ_SERIES.length]}
                strokeWidth={selected ? 2 : 0}
              />
              <SvgText
                x={point.x}
                y={Math.max(14, point.y - 10)}
                fill={selected ? TEXT_PRIMARY : TEXT_SECONDARY}
                fontSize={10}
                fontWeight={selected ? '700' : '500'}
                textAnchor="middle"
              >
                {formatValue(item.value ?? 0, item.unit || visual.unit)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {labels.map((label, index) => {
          const x = labels.length === 1
            ? (plotLeft + plotRight) / 2
            : plotLeft + (index / (labels.length - 1)) * (plotRight - plotLeft);
          return (
            <SvgText key={label} x={x} y={176} fill={TEXT_SECONDARY} fontSize={10} textAnchor="middle">
              {index + 1}
            </SvgText>
          );
        })}
      </Svg>
      {visual.items.map((item) => {
        const point = pointFor(item);
        return (
          <Pressable
            key={`hit-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={itemAccessibilityLabel(item, visual)}
            accessibilityState={{ selected: item.id === selectedId }}
            hitSlop={6}
            onPress={() => onSelect(item.id)}
            style={[styles.pointHit, { left: point.x - 22, top: point.y - 22 }]}
          />
        );
      })}
      <View style={styles.lineCategories} pointerEvents="none">
        {labels.map((label, index) => (
          <View key={label} style={styles.lineCategory}>
            <Text style={styles.lineCategoryIndex}>{index + 1}</Text>
            <Text style={styles.lineCategoryLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {groups.length > 1 ? (
        <View style={styles.lineSeriesLegend} pointerEvents="none">
          {groups.map((group, index) => (
            <View key={group} style={styles.lineSeriesItem}>
              <View
                style={[
                  styles.lineSeriesDot,
                  { backgroundColor: VIZ_SERIES[index % VIZ_SERIES.length] },
                ]}
              />
              <Text style={styles.lineSeriesText}>{group}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {visual.yLabel ? <Text style={styles.lineYLabel}>{visual.yLabel}</Text> : null}
      {visual.xLabel ? <Text style={styles.lineXLabel}>{visual.xLabel}</Text> : null}
    </View>
  );
}

function SelectionDetail({
  item,
  visual,
  reduceMotion,
  onOpenStep,
}: {
  item?: NucleoVisualItem;
  visual: NucleoVisualSpec;
  reduceMotion: boolean;
  onOpenStep?: (stepId: string) => void;
}) {
  const progress = useSharedValue(1);
  const previousId = useRef(item?.id);

  useEffect(() => {
    if (previousId.current === item?.id) return;
    previousId.current = item?.id;
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : MOTION_MS });
  }, [item?.id, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + progress.value * 0.28,
    transform: [{ translateY: (1 - progress.value) * 5 }],
  }));

  if (!item) return null;
  const reference = item.references?.[0] ?? visual.references?.[0];
  return (
    <Animated.View style={[styles.detail, animatedStyle]} accessibilityLiveRegion="polite">
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{item.label}</Text>
        {Number.isFinite(item.value) ? (
          <Text style={styles.detailValue}>{formatValue(item.value!, item.unit || visual.unit)}</Text>
        ) : null}
        {item.detail ? <Text style={styles.detailText}>{item.detail}</Text> : null}
        {reference ? (
          <Text style={styles.referenceText}>{`${reference.label} · ${reference.locator}`}</Text>
        ) : null}
      </View>
      {item.stepId && onOpenStep ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir paso relacionado: ${item.label}`}
          onPress={() => onOpenStep(item.stepId!)}
          style={({ pressed }) => [styles.openStep, pressed && styles.pressed]}
        >
          <Text style={styles.openStepText}>Abrir paso →</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export default function NucleoVisualOverview({
  visual,
  compact = false,
  showTitle = true,
  onOpenStep,
}: NucleoVisualOverviewProps) {
  const { reduceMotion } = useGlassAccessibility();
  const [selectedId, setSelectedId] = useState(visual.items[0]?.id ?? '');
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    setSelectedId(visual.items[0]?.id ?? '');
  }, [visual]);

  const selected = useMemo(
    () => visual.items.find((item) => item.id === selectedId) ?? visual.items[0],
    [selectedId, visual.items]
  );

  const selectItem = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    stepHaptic();
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
  };

  const rendererProps: VisualRendererProps = {
    visual,
    selectedId: selected?.id ?? '',
    onSelect: selectItem,
    width,
    reduceMotion,
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.root, compact && styles.rootCompact]}
      accessibilityRole="summary"
      accessibilityLabel={`${visual.title}. ${visual.summary}`}
    >
      {showTitle ? (
        <View style={styles.visualHeading}>
          <Text style={styles.visualTitle}>{visual.title}</Text>
          <Text style={styles.visualSummary}>{visual.summary}</Text>
        </View>
      ) : null}

      {visual.kind === 'comparison' ? <ComparisonVisual {...rendererProps} /> : null}
      {visual.kind === 'bar' ? <BarVisual {...rendererProps} /> : null}
      {visual.kind === 'line' ? <LineVisual {...rendererProps} /> : null}
      {['concept', 'flow', 'cycle', 'hierarchy'].includes(visual.kind) ? (
        <DiagramVisual {...rendererProps} />
      ) : null}

      <SelectionDetail
        item={selected}
        visual={visual}
        reduceMotion={reduceMotion}
        onOpenStep={onOpenStep}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginTop: 18,
    marginBottom: 16,
  },
  rootCompact: {
    marginTop: 12,
    marginBottom: 10,
  },
  visualHeading: {
    marginBottom: 16,
  },
  visualTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  visualSummary: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  nodeFrame: {
    position: 'absolute',
  },
  nodePressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: VIZ_GRID,
  },
  nodeSelected: {
    borderTopWidth: 2,
    borderTopColor: ACCENT,
  },
  nodeMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 7,
    backgroundColor: VIZ_MUTED,
  },
  nodeMarkerSelected: {
    backgroundColor: ACCENT,
  },
  nodeLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nodeLabelSelected: {
    color: TEXT_PRIMARY,
  },
  pressed: {
    opacity: 0.7,
  },
  comparison: {
    width: '100%',
    minHeight: 180,
  },
  comparisonHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 12,
  },
  comparisonRow: {
    borderTopWidth: 1,
    borderTopColor: VIZ_GRID,
    paddingTop: 8,
    marginTop: 4,
  },
  comparisonDimension: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  comparisonCells: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 8,
    gap: 12,
  },
  comparisonCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  columnDivider: {
    borderLeftWidth: 1,
    borderLeftColor: VIZ_GRID,
  },
  comparisonCellSelected: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  groupLabel: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  comparisonLabel: {
    color: TEXT_BODY,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  comparisonDetail: {
    width: '100%',
    flexShrink: 1,
    color: TEXT_SECONDARY,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  comparisonValue: {
    color: ACCENT,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  barRoot: {
    width: '100%',
    paddingTop: 4,
  },
  barRow: {
    marginBottom: 14,
  },
  barLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  barLabel: {
    flex: 1,
    color: TEXT_BODY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  barValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  barTrack: {
    height: 8,
    position: 'relative',
    backgroundColor: VIZ_GRID,
  },
  zeroLine: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 1,
    backgroundColor: TEXT_SECONDARY,
  },
  barMark: {
    position: 'absolute',
    top: 0,
    height: 8,
  },
  axisTitle: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    marginBottom: 12,
  },
  axisCaption: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
  },
  pointHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  lineYLabel: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: TEXT_SECONDARY,
    fontSize: 10,
  },
  lineXLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    color: TEXT_SECONDARY,
    fontSize: 10,
  },
  lineCategories: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 188,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lineSeriesLegend: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '72%',
  },
  lineSeriesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lineSeriesDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lineSeriesText: {
    color: TEXT_SECONDARY,
    fontSize: 9,
  },
  lineCategory: {
    width: '50%',
    minHeight: 23,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingRight: 8,
  },
  lineCategoryIndex: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '800',
  },
  lineCategoryLabel: {
    flex: 1,
    color: TEXT_SECONDARY,
    fontSize: 10,
    lineHeight: 14,
  },
  detail: {
    minHeight: 76,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: VIZ_GRID,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  detailValue: {
    color: ACCENT,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  detailText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  referenceText: {
    color: VIZ_MUTED,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 5,
  },
  openStep: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 6,
  },
  openStepText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
});
