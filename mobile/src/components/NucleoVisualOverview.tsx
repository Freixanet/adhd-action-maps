import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { area as d3Area, curveMonotoneX, line as d3Line } from 'd3-shape';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  TEXT_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VIZ_GRID,
  VIZ_MUTED,
  VIZ_SERIES,
  RADII,
  accentLine,
  barGradient,
  motion as vizMotion,
  GLASS_PERIMETER_HIGHLIGHT_COLOR_DARK,
  success,
  elevatedSurface,
  nodeSelectedBorder,
  connectorActive,
  statusOrbGlow,
} from '@shared/uiTokens';
import { getVisualGeometry, type VisualNodeFrame } from '@shared/nucleoVisualGeometry';
import type {
  NucleoVisualItem,
  NucleoVisualLink,
  NucleoVisualSpec,
} from '../logic/contracts';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { PRESS_RETENTION_OFFSET } from '../hooks/usePressSpring';
import { useCalmPress } from '../hooks/useCalmPress';
import { color, primitive, type, typography, radius } from '@shared/design-tokens';
import PressableScale from './PressableScale';

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
const BAR_TRACK_H = 10;
const BAR_TRACK_RX = 5;
const BAR_VALUE_COL = 32;
const BAR_GLOW_R = 8;
const BAR_SVG_H = 20;
const BAR_TRACK_Y = (BAR_SVG_H - BAR_TRACK_H) / 2;
const BAR_EASE = Easing.bezier(...vizMotion.easing);
const LINE_DRAW_MS = 700;
const LINE_FADE_MS = 150;
const AREA_FADE_MS = 250;
const AREA_DELAY_MS = 150;
const LINE_DASH_FALLBACK = 3000;
const LINE_GRID_COUNT = 4;
const LINE_STROKE_WIDTH = 2.25;
const LINE_ACTIVE_R = 3.5;
const LINE_HALO_R = 8;
const NODE_ORB_SLOT = 18;
const NODE_ORB_PENDING = 6;
const NODE_ORB_ACTIVE = 8;
const CONNECTOR_WIDTH = 1.25;

type NodeStatus = 'pending' | 'active' | 'done';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type ChartPoint = { x: number; y: number };
type MeasurablePath = { getTotalLength?: () => number };

const monotoneLine = d3Line<ChartPoint>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveMonotoneX);

function chordLength(points: ChartPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

function monotoneArea(y0: number) {
  return d3Area<ChartPoint>()
    .x((point) => point.x)
    .y0(y0)
    .y1((point) => point.y)
    .curve(curveMonotoneX);
}

function formatValue(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function itemAccessibilityLabel(
  item: NucleoVisualItem,
  visual: NucleoVisualSpec,
  status?: NodeStatus,
): string {
  const value = Number.isFinite(item.value)
    ? ` ${formatValue(item.value!, item.unit || visual.unit)}.`
    : '';
  const statusLabel =
    status === 'done' ? ' Completado.' : status === 'active' ? ' Actual.' : status === 'pending' ? ' Pendiente.' : '';
  return `${item.label}.${value}${statusLabel} ${item.detail || ''}`.trim();
}

function nodeStatusFor(
  items: NucleoVisualItem[],
  index: number,
  selectedId: string,
  kind: NucleoVisualSpec['kind'],
): NodeStatus {
  if (items[index]?.id === selectedId) return 'active';
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const sequential = kind === 'flow' || kind === 'cycle' || kind === 'hierarchy';
  if (sequential && selectedIndex >= 0 && index < selectedIndex) return 'done';
  return 'pending';
}

function StatusOrb({ status }: { status: NodeStatus }) {
  if (status === 'done') {
    return (
      <View style={styles.statusOrbSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={NODE_ORB_SLOT} height={NODE_ORB_SLOT}>
          <Circle
            cx={NODE_ORB_SLOT / 2}
            cy={NODE_ORB_SLOT / 2}
            r={8}
            fill="none"
            stroke={success}
            strokeWidth={1.5}
          />
          <Path
            d="M5.2 9.2 L8 12 L12.8 6.4"
            fill="none"
            stroke={success}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View
        style={[styles.statusOrbSlot, styles.statusOrbActiveGlow]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.statusOrbActiveDot} />
      </View>
    );
  }
  return (
    <View style={styles.statusOrbSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.statusOrbPendingDot} />
    </View>
  );
}

function AnimatedNode({
  item,
  visual,
  selected,
  status,
  onPress,
  frame,
  reduceMotion,
}: {
  item: NucleoVisualItem;
  visual: NucleoVisualSpec;
  selected: boolean;
  status: NodeStatus;
  onPress: () => void;
  frame: VisualNodeFrame;
  reduceMotion: boolean;
}) {
  const selection = useSharedValue(selected ? 1 : 0);
  const mounted = useRef(false);
  const { pressed, handlers } = useCalmPress();

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
    transform: [{ scale: (1 + selection.value * 0.035) * (1 - pressed.value * 0.025) }],
  }));

  return (
    <Animated.View
      style={[
        styles.nodeFrame,
        { left: frame.x, top: frame.y, width: frame.width, height: Math.max(frame.height, 52) },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlers.onPressIn}
        onPressOut={handlers.onPressOut}
        hitSlop={6}
        pressRetentionOffset={PRESS_RETENTION_OFFSET}
        accessibilityRole="button"
        accessibilityLabel={itemAccessibilityLabel(item, visual, status)}
        accessibilityState={{ selected }}
        style={styles.nodeFill}
      >
        <View style={[styles.nodePressable, selected && styles.nodeSelected]}>
          <StatusOrb status={status} />
          <Text numberOfLines={3} style={[styles.nodeLabel, selected && styles.nodeLabelSelected]}>
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function connectorPath(from: VisualNodeFrame, to: VisualNodeFrame): string {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const down = dy >= 0;
    x1 = fromCx;
    y1 = down ? from.y + from.height : from.y;
    x2 = toCx;
    y2 = down ? to.y : to.y + to.height;
  } else {
    const right = dx >= 0;
    x1 = right ? from.x + from.width : from.x;
    y1 = fromCy;
    x2 = right ? to.x : to.x + to.width;
    y2 = toCy;
  }
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function arrowHead(from: VisualNodeFrame, to: VisualNodeFrame): { d: string; x: number; y: number } {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const down = dy >= 0;
    x1 = fromCx;
    y1 = down ? from.y + from.height : from.y;
    x2 = toCx;
    y2 = down ? to.y : to.y + to.height;
  } else {
    const right = dx >= 0;
    x1 = right ? from.x + from.width : from.x;
    y1 = fromCy;
    x2 = right ? to.x : to.x + to.width;
    y2 = toCy;
  }
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const size = 6;
  const leftX = x2 - Math.cos(angle - Math.PI / 5) * size;
  const leftY = y2 - Math.sin(angle - Math.PI / 5) * size;
  const rightX = x2 - Math.cos(angle + Math.PI / 5) * size;
  const rightY = y2 - Math.sin(angle + Math.PI / 5) * size;
  return { d: `M ${leftX} ${leftY} L ${x2} ${y2} L ${rightX} ${rightY}`, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

function ConnectorLayer({
  items,
  frames,
  links,
  arrow,
  selectedId,
  width,
  height,
}: {
  items: NucleoVisualItem[];
  frames: VisualNodeFrame[];
  links: NucleoVisualLink[];
  arrow: boolean;
  selectedId: string;
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
        const active = link.source === selectedId || link.target === selectedId;
        const stroke = active ? connectorActive : color.background.whiteFade12;
        const head = arrowHead(source, target);
        return (
          <React.Fragment key={`${link.source}-${link.target}`}>
            <Path
              d={connectorPath(source, target)}
              fill="none"
              stroke={stroke}
              strokeWidth={CONNECTOR_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={active ? '4 6' : undefined}
            />
            {arrow ? (
              <Path
                d={head.d}
                fill="none"
                stroke={stroke}
                strokeWidth={CONNECTOR_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {link.label ? (
              <SvgText
                x={head.x}
                y={head.y - 5}
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
        selectedId={selectedId}
        width={geometry.width}
        height={geometry.height}
      />
      {visual.items.map((item, index) => (
        <AnimatedNode
          key={item.id}
          item={item}
          visual={visual}
          selected={item.id === selectedId}
          status={nodeStatusFor(visual.items, index, selectedId, visual.kind)}
          onPress={() => onSelect(item.id)}
          frame={geometry.frames[index]}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

function ComparisonVisual({ visual, selectedId, onSelect, reduceMotion }: VisualRendererProps) {
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
                <PressableScale
                  key={item.id}
                  onPress={() => onSelect(item.id)}
                  reduceMotion={reduceMotion}
                  accessibilityLabel={itemAccessibilityLabel(item, visual)}
                  accessibilityState={{ selected }}
                  style={styles.comparisonCellFrame}
                  contentStyle={[
                    styles.comparisonCell,
                    groupIndex > 0 && styles.columnDivider,
                    selected && styles.comparisonCellSelected,
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
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function currentPeriodIndex(items: NucleoVisualItem[]): number {
  let best = items.length - 1;
  let bestOrder = Number.NEGATIVE_INFINITY;
  items.forEach((item, index) => {
    if (typeof item.order === 'number' && item.order >= bestOrder) {
      bestOrder = item.order;
      best = index;
    }
  });
  return best;
}

function CapsuleBar({
  index,
  value,
  fillWidth,
  trackWidth,
  plotWidth,
  formattedValue,
  showGlow,
  reduceMotion,
}: {
  index: number;
  value: number;
  fillWidth: number;
  trackWidth: number;
  plotWidth: number;
  formattedValue: string;
  showGlow: boolean;
  reduceMotion: boolean;
}) {
  const reactId = useId();
  const idSuffix = `${index}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fillGradId = `bar${idSuffix}-fill`;
  const glowGradId = `bar${idSuffix}-glow`;
  const clipId = `bar${idSuffix}-clip`;

  const widthSv = useSharedValue(fillWidth);
  const opacitySv = useSharedValue(reduceMotion ? 1 : 0);
  const didMount = useRef(false);
  const valueRef = useRef(value);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      widthSv.value = fillWidth;
      if (reduceMotion) {
        opacitySv.value = 1;
        return;
      }
      const delay = Math.min(index * vizMotion.staggerStep, vizMotion.staggerTotalCapMs);
      opacitySv.value = withDelay(
        delay,
        withTiming(1, { duration: primitive.duration.micro }),
      );
      return;
    }
    if (valueRef.current === value) {
      widthSv.value = fillWidth;
      return;
    }
    valueRef.current = value;
    widthSv.value = withTiming(fillWidth, {
      duration: reduceMotion ? 0 : vizMotion.progress,
      easing: BAR_EASE,
    });
  }, [fillWidth, index, opacitySv, reduceMotion, value, widthSv]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacitySv.value }));
  const fillWidthProps = useAnimatedProps(() => ({ width: widthSv.value }));
  const glowCxProps = useAnimatedProps(() => ({ cx: widthSv.value }));

  return (
    <Animated.View style={fadeStyle}>
      <Svg width={plotWidth} height={BAR_SVG_H} pointerEvents="none">
        <Defs>
          <LinearGradient id={fillGradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={barGradient[0]} />
            <Stop offset="1" stopColor={barGradient[1]} />
          </LinearGradient>
          <RadialGradient id={glowGradId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color.orb.core} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color.orb.core} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={clipId}>
            <AnimatedRect
              x={0}
              y={BAR_TRACK_Y}
              width={fillWidth}
              height={BAR_TRACK_H}
              rx={BAR_TRACK_RX}
              ry={BAR_TRACK_RX}
              animatedProps={fillWidthProps}
            />
          </ClipPath>
        </Defs>
        <Rect
          x={0}
          y={BAR_TRACK_Y}
          width={trackWidth}
          height={BAR_TRACK_H}
          rx={BAR_TRACK_RX}
          ry={BAR_TRACK_RX}
          fill={color.background.whiteFade06}
        />
        {showGlow ? (
          <AnimatedCircle
            cx={fillWidth}
            r={BAR_GLOW_R}
            cy={BAR_TRACK_Y + BAR_TRACK_H / 2}
            fill={`url(#${glowGradId})`}
            animatedProps={glowCxProps}
          />
        ) : null}
        <AnimatedRect
          x={0}
          y={BAR_TRACK_Y}
          width={fillWidth}
          height={BAR_TRACK_H}
          rx={BAR_TRACK_RX}
          ry={BAR_TRACK_RX}
          fill={`url(#${fillGradId})`}
          animatedProps={fillWidthProps}
        />
        <AnimatedRect
          x={0}
          y={BAR_TRACK_Y}
          width={fillWidth}
          height={1}
          fill={color.background.whiteFade20}
          clipPath={`url(#${clipId})`}
          animatedProps={fillWidthProps}
        />
        <SvgText
          x={trackWidth + 4}
          y={BAR_SVG_H / 2}
          fill={color.background.whiteFade72}
          fontSize={12}
          alignmentBaseline="middle"
        >
          {formattedValue}
        </SvgText>
      </Svg>
    </Animated.View>
  );
}

function BarVisual({ visual, selectedId, onSelect, width, reduceMotion }: VisualRendererProps) {
  const values = visual.items.map((item) => item.value ?? 0);
  const maximum = Math.max(0, ...values);
  const plotWidth = Math.max(120, width - 8);
  const trackWidth = Math.max(0, plotWidth - BAR_VALUE_COL);
  const groups = [...new Set(visual.items.map((item) => item.group || 'Serie'))];
  const currentIndex = currentPeriodIndex(visual.items);

  return (
    <View style={styles.barRoot}>
      {visual.yLabel ? <Text style={styles.axisTitle}>{visual.yLabel}</Text> : null}
      {visual.items.map((item, index) => {
        const value = item.value ?? 0;
        const fillWidth = maximum > 0 ? (Math.max(0, value) / maximum) * trackWidth : 0;
        const selected = item.id === selectedId;
        const showGlow = index === currentIndex && value > 40;
        return (
          <PressableScale
            key={item.id}
            onPress={() => onSelect(item.id)}
            reduceMotion={reduceMotion}
            accessibilityLabel={itemAccessibilityLabel(item, visual)}
            accessibilityState={{ selected }}
            contentStyle={styles.barRow}
          >
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLabel, selected && styles.nodeLabelSelected]}>
                {groups.length > 1 ? `${item.group || 'Serie'} · ${item.label}` : item.label}
              </Text>
            </View>
            <CapsuleBar
              index={index}
              value={value}
              fillWidth={fillWidth}
              trackWidth={trackWidth}
              plotWidth={plotWidth}
              formattedValue={formatValue(value, item.unit || visual.unit)}
              showGlow={showGlow}
              reduceMotion={reduceMotion}
            />
          </PressableScale>
        );
      })}
      {visual.xLabel ? <Text style={styles.axisCaption}>{visual.xLabel}</Text> : null}
    </View>
  );
}

function LineSeries({
  seriesIndex,
  points,
  plotBottom,
  chartId,
  reduceMotion,
}: {
  seriesIndex: number;
  points: ChartPoint[];
  plotBottom: number;
  chartId: string;
  reduceMotion: boolean;
}) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const lineD = sorted.length ? monotoneLine(sorted) ?? '' : '';
  const areaD = sorted.length ? monotoneArea(plotBottom)(sorted) ?? '' : '';
  const areaGradId = `line${seriesIndex}-area-${chartId}`;
  const pathRef = useRef<MeasurablePath | null>(null);
  const entered = useRef(false);
  const dashOffset = useSharedValue(reduceMotion ? 0 : LINE_DASH_FALLBACK);
  const dashLength = useSharedValue(LINE_DASH_FALLBACK);
  const lineOpacity = useSharedValue(reduceMotion ? 0 : 1);
  const areaOpacity = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || !lineD) return;
        const measured = pathRef.current?.getTotalLength?.();
        const length =
          measured && measured > 0 ? measured : chordLength(sorted) || LINE_DASH_FALLBACK;
        dashLength.value = length;
        if (!entered.current) {
          entered.current = true;
          if (reduceMotion) {
            dashOffset.value = 0;
            lineOpacity.value = withTiming(1, { duration: LINE_FADE_MS });
            areaOpacity.value = withTiming(1, { duration: LINE_FADE_MS });
            return;
          }
          dashOffset.value = length;
          dashOffset.value = withTiming(0, { duration: LINE_DRAW_MS, easing: BAR_EASE });
          areaOpacity.value = withDelay(AREA_DELAY_MS, withTiming(1, { duration: AREA_FADE_MS }));
          return;
        }
        dashOffset.value = 0;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [areaOpacity, dashLength, dashOffset, lineD, lineOpacity, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
    strokeDasharray: [dashLength.value, dashLength.value],
    opacity: lineOpacity.value,
  }));
  const areaProps = useAnimatedProps(() => ({ opacity: areaOpacity.value }));

  if (!lineD) return null;

  return (
    <>
      <Defs>
        <LinearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.background.accentFade16} />
          <Stop offset="1" stopColor={color.orb.coreTransparent} />
        </LinearGradient>
      </Defs>
      <Path
        ref={(node) => {
          pathRef.current = node as MeasurablePath | null;
        }}
        d={lineD}
        fill="none"
        stroke={accentLine}
        strokeWidth={LINE_STROKE_WIDTH}
        pointerEvents="none"
        opacity={0}
      />
      <AnimatedPath d={areaD} fill={`url(#${areaGradId})`} stroke="none" animatedProps={areaProps} />
      <AnimatedPath
        d={lineD}
        fill="none"
        stroke={accentLine}
        strokeWidth={LINE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={lineProps}
      />
    </>
  );
}

function LineVisual({ visual, selectedId, onSelect, width, reduceMotion }: VisualRendererProps) {
  const reactId = useId();
  const chartId = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
  const haloGradId = `line-halo-${chartId}`;
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
  const selectedItem = visual.items.find((item) => item.id === selectedId) ?? visual.items[0];
  const selectedPoint = selectedItem ? pointFor(selectedItem) : null;
  const gridYs = Array.from({ length: LINE_GRID_COUNT }, (_, index) => {
    const t = index / (LINE_GRID_COUNT - 1);
    return plotTop + t * (plotBottom - plotTop);
  });

  return (
    <View style={{ width, height: chartHeight }}>
      <Svg width={width} height={chartHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={haloGradId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color.background.accentSoft} />
            <Stop offset="1" stopColor={color.orb.coreTransparent} />
          </RadialGradient>
        </Defs>
        {gridYs.map((y) => (
          <Line
            key={`grid-${y}`}
            x1={plotLeft}
            y1={y}
            x2={plotRight}
            y2={y}
            stroke={color.background.whiteFade05}
            strokeWidth={1}
            strokeDasharray="4 6"
          />
        ))}
        {groups.map((group, seriesIndex) => {
          const points = visual.items
            .filter((item) => (item.group || 'Serie') === group)
            .map(pointFor);
          return (
            <LineSeries
              key={group}
              seriesIndex={seriesIndex}
              points={points}
              plotBottom={plotBottom}
              chartId={chartId}
              reduceMotion={reduceMotion}
            />
          );
        })}
        {selectedPoint ? (
          <>
            <Circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={LINE_HALO_R}
              fill={`url(#${haloGradId})`}
            />
            <Circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={LINE_ACTIVE_R}
              fill={GLASS_PERIMETER_HIGHLIGHT_COLOR_DARK}
            />
          </>
        ) : null}
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
          {groups.map((group) => (
            <View key={group} style={styles.lineSeriesItem}>
              <View style={[styles.lineSeriesDot, { backgroundColor: accentLine }]} />
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
        <PressableScale
          onPress={() => onOpenStep(item.stepId!)}
          reduceMotion={reduceMotion}
          accessibilityLabel={`Abrir paso relacionado: ${item.label}`}
          contentStyle={styles.openStep}
        >
          <Text style={styles.openStepText}>Abrir paso →</Text>
        </PressableScale>
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
    ...typography('sectionTitle'),
  },
  visualSummary: {
    color: TEXT_SECONDARY,
    ...typography('label'),
    marginTop: 5,
  },
  nodeFrame: {
    position: 'absolute',
    overflow: 'visible',
  },
  nodeFill: {
    width: '100%',
    height: '100%',
    minHeight: 44,
    overflow: 'visible',
  },
  nodePressable: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.card,
    ...elevatedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
    gap: 10,
  },
  nodeSelected: {
    borderWidth: 1.5,
    borderColor: nodeSelectedBorder,
  },
  statusOrbSlot: {
    width: NODE_ORB_SLOT,
    height: NODE_ORB_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  statusOrbPendingDot: {
    width: NODE_ORB_PENDING,
    height: NODE_ORB_PENDING,
    borderRadius: NODE_ORB_PENDING / 2,
    backgroundColor: color.orb.whiteFade18,
  },
  statusOrbActiveDot: {
    width: NODE_ORB_ACTIVE,
    height: NODE_ORB_ACTIVE,
    borderRadius: NODE_ORB_ACTIVE / 2,
    backgroundColor: color.orb.core,
  },
  statusOrbActiveGlow: {
    ...statusOrbGlow,
  },
  nodeLabel: {
    flex: 1,
    color: TEXT_SECONDARY,
    ...typography('caption'),
    textAlign: 'left',
  },
  nodeLabelSelected: {
    color: TEXT_PRIMARY,
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
    ...typography('caption'),
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  comparisonCells: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 8,
    gap: 12,
  },
  comparisonCellFrame: {
    flex: 1,
    minWidth: 0,
  },
  comparisonCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 6,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  columnDivider: {
    borderLeftWidth: 1,
    borderLeftColor: VIZ_GRID,
  },
  comparisonCellSelected: {
    borderWidth: 1.5,
    borderColor: nodeSelectedBorder,
    backgroundColor: color.background.accentFade10,
  },
  groupLabel: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    ...typography('metaWide'),
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  comparisonLabel: {
    color: TEXT_BODY,
    ...typography('label'),
  },
  comparisonDetail: {
    width: '100%',
    flexShrink: 1,
    color: TEXT_SECONDARY,
    ...typography('meta'),
    marginTop: 4,
  },
  comparisonValue: {
    color: accentLine,
    ...typography('caption'),
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
    marginBottom: 6,
  },
  barLabel: {
    flex: 1,
    color: TEXT_BODY,
    ...typography('caption'),
  },
  axisTitle: {
    color: TEXT_SECONDARY,
    fontSize: type.meta.fontSize,
    marginBottom: 12,
  },
  axisCaption: {
    color: TEXT_SECONDARY,
    fontSize: type.micro.fontSize,
    textAlign: 'right',
    marginTop: 2,
  },
  pointHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: radius.overview,
  },
  lineYLabel: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: TEXT_SECONDARY,
    fontSize: type.micro.fontSize,
  },
  lineXLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    color: TEXT_SECONDARY,
    fontSize: type.micro.fontSize,
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
    borderRadius: radius.tick,
  },
  lineSeriesText: {
    color: TEXT_SECONDARY,
    fontSize: type.microLabel.fontSize,
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
    color: accentLine,
    ...typography('microExtrabold'),
  },
  lineCategoryLabel: {
    flex: 1,
    color: TEXT_SECONDARY,
    ...typography('micro'),
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
    ...typography('callout'),
  },
  detailValue: {
    color: accentLine,
    ...typography('caption'),
    marginTop: 2,
  },
  detailText: {
    color: TEXT_SECONDARY,
    ...typography('label'),
    marginTop: 3,
  },
  referenceText: {
    color: VIZ_MUTED,
    ...typography('micro'),
    marginTop: 5,
  },
  openStep: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 6,
  },
  openStepText: {
    color: accentLine,
    ...typography('captionBold'),
  },
});
