import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  processTransform3d,
  vec,
} from '@shopify/react-native-skia';
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BG_BASE } from '@shared/uiTokens';
import { isSkiaAvailable } from '../logic/skiaAvailability';
import ExactLiquidOrbWebView from './ExactLiquidOrbWebView';
import { liquidOrbLayout, nucleusCornerRadii } from './liquidOrbLayout';

const AMBIENT_GLOW_COLORS = [
  'rgba(139, 143, 245, 0.14)',
  'rgba(139, 143, 245, 0.05)',
  'rgba(139, 143, 245, 0)',
] as const;
const AMBIENT_GLOW_POSITIONS = [0, 0.42, 0.72] as const;
const ACCENT_06 = 'rgba(139, 143, 245, 0.6)';
const ACCENT_025 = 'rgba(139, 143, 245, 0.25)';
const ACCENT_03 = 'rgba(139, 143, 245, 0.3)';

const GLASS_FILL_COLORS = [
  'rgba(255, 255, 255, 0.05)',
  'rgba(139, 143, 245, 0.06)',
  'rgba(10, 10, 16, 0.22)',
] as const;

/** Vertical specular map — same directional pattern as GlassPerimeterRing circular stops. */
const FRESNEL_TOP_STOPS = {
  colors: [
    'rgba(255, 255, 255, 0.55)',
    'rgba(255, 255, 255, 0.14)',
    'rgba(255, 255, 255, 0)',
    'rgba(255, 255, 255, 0)',
    'rgba(255, 255, 255, 0)',
  ],
  positions: [0, 0.28, 0.52, 0.85, 1],
} as const;

const FRESNEL_BOTTOM_STOPS = {
  colors: [
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0)',
    'rgba(0, 0, 0, 0.28)',
    'rgba(0, 0, 0, 0.4)',
  ],
  positions: [0, 0.52, 0.72, 0.88, 1],
} as const;

const SPHERE_SHADING_COLORS = [
  'rgba(255, 255, 255, 0.10)',
  'rgba(255, 255, 255, 0)',
  'rgba(0, 0, 0, 0.22)',
] as const;
const SPHERE_SHADING_POSITIONS = [0, 0.45, 1] as const;

/** HTML iteration specular — radial falloff + blur(3px), soft skirt to edge. */
const SPECULAR_GRADIENT_COLORS = [
  'rgba(255, 255, 255, 0.65)',
  'rgba(255, 255, 255, 0.18)',
  'rgba(255, 255, 255, 0.04)',
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0)',
] as const;
const SPECULAR_GRADIENT_POSITIONS = [0, 0.3, 0.55, 0.82, 1] as const;
const SPECULAR_ROTATION_DEG = -24;

const ORBIT_ROTATIONS = [35, -45, 80] as const;
/** HTML dirs per orbit group: +1, -1, +1 */
const ORBIT_PHASE_DIRS = [1, -1, 1] as const;
/** Matches original CSS dashA/dashB: period 280 viewBox units in 0.7s linear. */
const ORBIT_SPEED = 400;
const ORBIT_DASH_SEG = 120;
const ORBIT_DASH_GAP = 160;
const DEG = Math.PI / 180;

type LiquidOrbSkiaProps = {
  size?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

function useOrbAnimations(reduceMotion: boolean, orbSize: number) {
  const unitScale = orbSize / 200;
  const loop4s = useSharedValue(0);
  const swirlRotation = useSharedValue(0);
  const orbitOffset = useSharedValue(0);
  const causticsProgress = useSharedValue(0);
  const nucleusProgress = useSharedValue(0);
  const animating = useSharedValue(reduceMotion ? 0 : 1);

  const levitationY = useSharedValue(0);
  const ambientScale = useSharedValue(1);
  const ambientOpacity = useSharedValue(0.25);
  const shadowScale = useSharedValue(0.9);
  const shadowOpacity = useSharedValue(0.2);
  const swirlRotateRad = useSharedValue(0);
  const causticsRotateRad = useSharedValue(0);
  const causticsScale = useSharedValue(1);

  useEffect(() => {
    animating.value = reduceMotion ? 0 : 1;
    cancelAnimation(loop4s);
    cancelAnimation(swirlRotation);
    cancelAnimation(causticsProgress);
    cancelAnimation(nucleusProgress);

    if (reduceMotion) {
      loop4s.value = 0;
      swirlRotation.value = 0;
      orbitOffset.value = 80 * unitScale;
      causticsProgress.value = 0;
      nucleusProgress.value = 0;
      levitationY.value = 0;
      ambientScale.value = 1;
      ambientOpacity.value = 0.25;
      shadowScale.value = 0.9;
      shadowOpacity.value = 0.2;
      swirlRotateRad.value = 0;
      causticsRotateRad.value = 0;
      causticsScale.value = 1;
      return;
    }

    ambientOpacity.value = 0.08;
    shadowScale.value = 1;
    shadowOpacity.value = 0.3;

    loop4s.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
    swirlRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    orbitOffset.value = 0;
    causticsProgress.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
    nucleusProgress.value = withRepeat(
      withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [
    ambientOpacity,
    ambientScale,
    animating,
    causticsProgress,
    causticsRotateRad,
    causticsScale,
    levitationY,
    loop4s,
    nucleusProgress,
    orbitOffset,
    orbSize,
    reduceMotion,
    shadowOpacity,
    shadowScale,
    swirlRotateRad,
    swirlRotation,
    unitScale,
  ]);

  useAnimatedReaction(
    () => loop4s.value,
    (value) => {
      if (animating.value === 0) return;
      levitationY.value = interpolate(value, [0, 0.5, 1], [0, -12, 0]);
      ambientScale.value = interpolate(value, [0, 0.5, 1], [1, 1.08, 1]);
      ambientOpacity.value = interpolate(value, [0, 0.5, 1], [0.08, 0.16, 0.08]);
      shadowScale.value = interpolate(value, [0, 0.5, 1], [1, 0.8, 1]);
      shadowOpacity.value = interpolate(value, [0, 0.5, 1], [0.3, 0.1, 0.3]);
    }
  );

  useAnimatedReaction(
    () => swirlRotation.value,
    (value) => {
      if (animating.value === 0) return;
      swirlRotateRad.value = value * DEG;
    }
  );

  useAnimatedReaction(
    () => causticsProgress.value,
    (value) => {
      if (animating.value === 0) return;
      causticsRotateRad.value = interpolate(value, [0, 0.5, 1], [0, -180, -360]) * DEG;
      causticsScale.value = interpolate(value, [0, 0.5, 1], [1, 1.15, 1]);
    }
  );

  useFrameCallback((frame) => {
    'worklet';
    if (animating.value === 0) return;
    const dtMs = frame.timeSincePreviousFrame;
    if (dtMs == null || dtMs <= 0) return;
    const dt = dtMs / 1000;
    if (dt > 0.05) return;
    orbitOffset.value += ORBIT_SPEED * dt * unitScale;
  });

  return {
    levitationY,
    ambientScale,
    ambientOpacity,
    shadowScale,
    shadowOpacity,
    swirlRotateRad,
    orbitOffset,
    causticsRotateRad,
    causticsScale,
    nucleusProgress,
    animating,
    unitScale,
  };
}

type OrbitLayerProps = {
  cx: number;
  cy: number;
  r: number;
  rotationDeg: number;
  dashIntervals: number[] | SharedValue<number[]>;
  dashPhase: SharedValue<number>;
};

const ORBIT_EDGE_FADE_POSITIONS = [0, 0.1, 0.9, 1] as const;
const ORBIT_HALO_EDGE_COLORS = [
  'rgba(139, 143, 245, 0)',
  'rgba(139, 143, 245, 0.22)',
  'rgba(139, 143, 245, 0.22)',
  'rgba(139, 143, 245, 0)',
] as const;
const ORBIT_CORE_EDGE_COLORS = [
  'rgba(198, 201, 255, 0)',
  'rgba(198, 201, 255, 0.85)',
  'rgba(198, 201, 255, 0.85)',
  'rgba(198, 201, 255, 0)',
] as const;

/** HTML iteration orbits — viewBox 200, rx 97 / ry 36, halo 14 + core 5, edge fade on major axis. */
function OrbitLayer({ cx, cy, r, rotationDeg, dashIntervals, dashPhase }: OrbitLayerProps) {
  const rx = r * 0.97;
  const ry = r * 0.36;
  const haloWidth = r * 0.14;
  const coreWidth = r * 0.05;
  const haloBlur = r * 0.085;
  const coreBlur = r * 0.02;

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({ x: -rx, y: -ry, width: rx * 2, height: ry * 2 });
    return p;
  }, [rx, ry]);

  const orbitTransform = useMemo(
    () => [
      { translateX: cx },
      { translateY: cy },
      { rotate: rotationDeg * DEG },
    ],
    [cx, cy, rotationDeg]
  );

  const edgeFadeGradient = useMemo(
    () => ({
      start: vec(-rx, 0),
      end: vec(rx, 0),
      positions: [...ORBIT_EDGE_FADE_POSITIONS],
    }),
    [rx]
  );

  return (
    <Group transform={orbitTransform} blendMode="screen">
      <Path path={path} style="stroke" strokeWidth={haloWidth} strokeCap="round">
        <LinearGradient
          start={edgeFadeGradient.start}
          end={edgeFadeGradient.end}
          colors={[...ORBIT_HALO_EDGE_COLORS]}
          positions={edgeFadeGradient.positions}
        />
        <DashPathEffect intervals={dashIntervals} phase={dashPhase} />
        <BlurMask blur={haloBlur} style="normal" respectCTM={false} />
      </Path>
      <Path path={path} style="stroke" strokeWidth={coreWidth} strokeCap="round">
        <LinearGradient
          start={edgeFadeGradient.start}
          end={edgeFadeGradient.end}
          colors={[...ORBIT_CORE_EDGE_COLORS]}
          positions={edgeFadeGradient.positions}
        />
        <DashPathEffect intervals={dashIntervals} phase={dashPhase} />
        <BlurMask blur={coreBlur} style="normal" respectCTM={false} />
      </Path>
      <Path path={path} style="stroke" strokeWidth={coreWidth} strokeCap="round">
        <LinearGradient
          start={edgeFadeGradient.start}
          end={edgeFadeGradient.end}
          colors={[...ORBIT_CORE_EDGE_COLORS]}
          positions={edgeFadeGradient.positions}
        />
        <DashPathEffect intervals={dashIntervals} phase={dashPhase} />
      </Path>
    </Group>
  );
}

type FresnelRimsProps = {
  cx: number;
  cy: number;
  r: number;
};

/** Directional rim strokes — vertical gradient opacity like GlassPerimeterRing. */
function FresnelRims({ cx, cy, r }: FresnelRimsProps) {
  const top = cy - r;
  const bottom = cy + r;

  return (
    <>
      <Circle cx={cx} cy={cy} r={r - 1} style="stroke" strokeWidth={1.5}>
        <LinearGradient
          start={vec(cx, top)}
          end={vec(cx, bottom)}
          colors={[...FRESNEL_TOP_STOPS.colors]}
          positions={[...FRESNEL_TOP_STOPS.positions]}
        />
      </Circle>
      <Circle cx={cx} cy={cy} r={r - 1} style="stroke" strokeWidth={1.5}>
        <LinearGradient
          start={vec(cx, top)}
          end={vec(cx, bottom)}
          colors={[...FRESNEL_BOTTOM_STOPS.colors]}
          positions={[...FRESNEL_BOTTOM_STOPS.positions]}
        />
      </Circle>
      <Circle
        cx={cx}
        cy={cy}
        r={r - 0.5}
        style="stroke"
        strokeWidth={1}
        color={ACCENT_025}
      />
    </>
  );
}

type SpecularHighlightProps = {
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** HTML iteration .specular — ellipse radial at 45%/45%, rotate -24°, blur 3px. */
function SpecularHighlight({ cx, cy, w, h }: SpecularHighlightProps) {
  const aspect = h / w;
  const gradCx = cx - w * 0.05;
  const gradCy = cy - w * 0.05;
  const gradR = w * 0.39;

  return (
    <Group
      origin={vec(cx, cy)}
      transform={[{ rotate: SPECULAR_ROTATION_DEG * DEG }, { scaleY: aspect }]}
    >
      <Oval x={cx - w / 2} y={cy - w / 2} width={w} height={w}>
        <RadialGradient
          c={vec(gradCx, gradCy)}
          r={gradR}
          colors={[...SPECULAR_GRADIENT_COLORS]}
          positions={[...SPECULAR_GRADIENT_POSITIONS]}
        />
        <BlurMask blur={4} style="normal" respectCTM={false} />
      </Oval>
    </Group>
  );
}

function LiquidOrbSkiaCanvas({
  size,
  reduceMotion,
}: {
  size: number;
  reduceMotion: boolean;
}) {
  const layout = useMemo(() => liquidOrbLayout(size), [size]);
  const {
    canvas,
    cx,
    cy,
    r,
    glowR,
    swirlR,
    specularCx,
    specularCy,
    specularW,
    specularH,
    causticsCx,
    causticsCy,
    causticsR,
    nucleusSize,
    shadowCx,
    shadowCy,
    shadowW,
    shadowH,
    glassGradientCx,
    glassGradientCy,
  } = layout;

  const anim = useOrbAnimations(reduceMotion, size);

  const clipPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(cx, cy, r);
    return p;
  }, [cx, cy, r]);

  const nucleusPath = useDerivedValue(() => {
    const progress = anim.animating.value === 0 ? 0 : anim.nucleusProgress.value;
    const corners = nucleusCornerRadii(nucleusSize, progress);
    const x = cx - nucleusSize / 2;
    const y = cy - nucleusSize / 2;
    const path = Skia.Path.Make();
    path.addRRect({
      rect: { x, y, width: nucleusSize, height: nucleusSize },
      topLeft: { x: corners.tlX, y: corners.tlY },
      topRight: { x: corners.trX, y: corners.trY },
      bottomRight: { x: corners.brX, y: corners.brY },
      bottomLeft: { x: corners.blX, y: corners.blY },
    });
    return path;
  });

  const nucleusMatrix = useDerivedValue(() => {
    const progress = anim.animating.value === 0 ? 0 : anim.nucleusProgress.value;
    return processTransform3d([
      { scale: interpolate(progress, [0, 0.5, 1], [0.85, 1.05, 0.85]) },
      { rotate: interpolate(progress, [0, 0.5, 1], [0, 180, 0]) * DEG },
    ]);
  });

  const nucleusOpacity = useDerivedValue(() => {
    if (anim.animating.value === 0) return 0.75;
    return interpolate(anim.nucleusProgress.value, [0, 0.5, 1], [0.75, 1, 0.75]);
  });

  const orbitDashIntervals = useMemo(
    () => [ORBIT_DASH_SEG * anim.unitScale, ORBIT_DASH_GAP * anim.unitScale],
    [anim.unitScale]
  );

  const orbitDashPhase0 = useDerivedValue(() => anim.orbitOffset.value * ORBIT_PHASE_DIRS[0]);
  const orbitDashPhase1 = useDerivedValue(() => anim.orbitOffset.value * ORBIT_PHASE_DIRS[1]);
  const orbitDashPhase2 = useDerivedValue(() => anim.orbitOffset.value * ORBIT_PHASE_DIRS[2]);
  const orbitDashPhases = [orbitDashPhase0, orbitDashPhase1, orbitDashPhase2] as const;

  const shadowMatrix = useDerivedValue(() =>
    processTransform3d([{ scale: anim.shadowScale.value }])
  );
  const levitationMatrix = useDerivedValue(() =>
    processTransform3d([{ translateY: anim.levitationY.value }])
  );
  const ambientMatrix = useDerivedValue(() =>
    processTransform3d([{ scale: anim.ambientScale.value }])
  );
  const swirlMatrix = useDerivedValue(() =>
    processTransform3d([{ rotate: anim.swirlRotateRad.value }])
  );
  const causticsMatrix = useDerivedValue(() =>
    processTransform3d([
      { rotate: anim.causticsRotateRad.value },
      { scale: anim.causticsScale.value },
    ])
  );

  return (
    <Canvas style={{ width: canvas, height: canvas, backgroundColor: 'transparent' }}>

      {/* levitation-shadow — sibling of wrapper, not translated */}
      <Group
        origin={vec(shadowCx, shadowCy)}
        matrix={shadowMatrix}
        opacity={anim.shadowOpacity}
      >
        <Oval
          x={shadowCx - shadowW / 2}
          y={shadowCy - shadowH / 2}
          width={shadowW}
          height={shadowH}
          color="#000000"
        >
          <BlurMask blur={2} style="normal" respectCTM={false} />
        </Oval>
      </Group>

      {/* levitation-wrapper */}
      <Group origin={vec(cx, cy)} matrix={levitationMatrix}>
        {/* ambient-glow — radial falloff like HTML .ambient (no solid circle + blur cutoff) */}
        <Group
          origin={vec(cx, cy)}
          matrix={ambientMatrix}
          opacity={anim.ambientOpacity}
        >
          <Circle cx={cx} cy={cy} r={glowR * 1.12}>
            <RadialGradient
              c={vec(cx, cy)}
              r={glowR * 1.12}
              colors={[...AMBIENT_GLOW_COLORS]}
              positions={[...AMBIENT_GLOW_POSITIONS]}
            />
          </Circle>
        </Group>

        {/* glass-shell clip */}
        <Group clip={clipPath}>
          {/* outer box-shadow: 0 10px 30px rgba(0,0,0,0.5) */}
          <Oval
            x={cx - r * 0.85}
            y={cy + r * 0.15}
            width={r * 1.7}
            height={r * 0.55}
            color="rgba(0, 0, 0, 0.5)"
          >
            <BlurMask blur={15} style="normal" respectCTM={false} />
          </Oval>

          {/* glass radial-gradient — nearly empty fill */}
          <Circle cx={cx} cy={cy} r={r}>
            <RadialGradient
              c={vec(glassGradientCx, glassGradientCy)}
              r={r}
              colors={[...GLASS_FILL_COLORS]}
              positions={[0, 0.5, 1]}
            />
          </Circle>

          {/* directional shading — top-lit sphere */}
          <Circle cx={cx} cy={cy} r={r}>
            <LinearGradient
              start={vec(cx, cy - r)}
              end={vec(cx, cy + r)}
              colors={[...SPHERE_SHADING_COLORS]}
              positions={[...SPHERE_SHADING_POSITIONS]}
            />
          </Circle>

          <FresnelRims cx={cx} cy={cy} r={r} />

          {/* swirl — conic-gradient, screen, blur 3, opacity 0.35 */}
          <Group
            origin={vec(cx, cy)}
            matrix={swirlMatrix}
            opacity={0.35}
            blendMode="screen"
          >
            <Circle cx={cx} cy={cy} r={swirlR}>
              <SweepGradient
                c={vec(cx, cy)}
                colors={['transparent', ACCENT_06, 'transparent', 'transparent']}
                positions={[0, 0.4, 0.6, 1]}
              />
              <BlurMask blur={3} style="normal" respectCTM={false} />
            </Circle>
          </Group>
        </Group>

        {/* orbits — no clip so halo blur fades out instead of a hard sphere edge */}
        <Group blendMode="screen">
          {ORBIT_ROTATIONS.map((rotationDeg, index) => (
            <OrbitLayer
              key={`orbit-${rotationDeg}`}
              cx={cx}
              cy={cy}
              r={r}
              rotationDeg={rotationDeg}
              dashIntervals={orbitDashIntervals}
              dashPhase={orbitDashPhases[index]}
            />
          ))}
        </Group>

        <Group clip={clipPath}>
          {/* nucleus */}
          <Group
            origin={vec(cx, cy)}
            matrix={nucleusMatrix}
            opacity={nucleusOpacity}
          >
            <Path path={nucleusPath} style="fill">
              <LinearGradient
                start={vec(cx - nucleusSize / 2, cy + nucleusSize / 2)}
                end={vec(cx + nucleusSize / 2, cy - nucleusSize / 2)}
                colors={['#dde3ff', '#9ba0f8', '#3b357e']}
              />
              <BlurMask blur={1} style="normal" respectCTM={false} />
            </Path>
            <Circle cx={cx} cy={cy} r={nucleusSize * 0.55} color={ACCENT_06}>
              <BlurMask blur={6} style="normal" respectCTM={false} />
            </Circle>
          </Group>

          {/* caustics */}
          <Group
            origin={vec(causticsCx, causticsCy)}
            matrix={causticsMatrix}
            opacity={0.18}
            blendMode="screen"
          >
            <Circle cx={causticsCx} cy={causticsCy} r={causticsR} color={ACCENT_03}>
              <BlurMask blur={12} style="normal" respectCTM={false} />
            </Circle>
          </Group>
        </Group>

        {/* specular — above nucleus, outside clip so blur skirt is not cropped */}
        <SpecularHighlight cx={specularCx} cy={specularCy} w={specularW} h={specularH} />
      </Group>
    </Canvas>
  );
}

export default function LiquidOrbSkia({
  size = 96,
  reduceMotion = false,
  style,
}: LiquidOrbSkiaProps) {
  const canvas = liquidOrbLayout(size).canvas;

  if (!isSkiaAvailable()) {
    return <ExactLiquidOrbWebView size={size} reduceMotion={reduceMotion} style={style} />;
  }

  return (
    <View
      style={[styles.shell, { width: canvas, height: canvas }, style]}
      pointerEvents="none"
      collapsable={false}
    >
      <LiquidOrbSkiaCanvas size={size} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    alignSelf: 'center',
  },
});
