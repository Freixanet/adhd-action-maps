export type AtomRibbon = {
  backPath: string;
  frontPath: string;
  grad: { x1: number; y1: number; x2: number; y2: number };
};

export type AtomGeometry = {
  cx: number;
  cy: number;
  coreR: number;
  haloR: number;
  sphereR: number;
  ribbons: AtomRibbon[];
  rim: { strokes: RimStroke[] };
  sphereLight: SphereLight;
};

export type SphereLight = {
  diffuseCx: number;
  diffuseCy: number;
  diffuseR: number;
  specCx: number;
  specCy: number;
  specR: number;
};

export type RimStroke = { d: string; width: number };

/** Toggle sphere volume / projected shadows when comparing effects. */
export const ATOM_SHADING = {
  enableSphereVolume: true,
  enableProjectedShadows: true,
  projectedShadowDx: 0.012,
  projectedShadowDy: 0.018,
  projectedShadowOpacity: { light: 0.14, dark: 0.22 },
  exteriorDropOpacity: { light: 0.32, dark: 0.42 },
  // Spherical glass volume: directional body shading (light top-left -> dark
  // bottom-right), a soft inner core shadow near the bottom-right rim, a
  // top-left highlight and a thin rim light on the far edge.
  sphereBodyShadowOpacity: { light: 0.09, dark: 0.13 },
  sphereDiffuseOpacity: { light: 0.38, dark: 0.32 },
  sphereHighlightOpacity: { light: 0.65, dark: 0.38 },
  sphereRimOpacity: { light: 0.55, dark: 0.65 },
  rimBrightAngleDeg: 45,
  rimMaxHalfW: 0.0055,
  rimExponent: 3.8,
  rimArcHalfDeg: 118,
  rimMinHalfWRatio: 0.006,
} as const;

type Point3D = { x: number; y: number; z: number };

type RibbonSample = Point3D & {
  halfW: number;
  ox: number;
  oy: number;
  ix: number;
  iy: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function fmt(n: number) {
  return n.toFixed(2);
}

function ribbonPathFromArc(outer: Array<{ x: number; y: number }>, inner: Array<{ x: number; y: number }>) {
  if (outer.length < 2 || inner.length < 2) return '';
  let d = `M${fmt(outer[0].x)} ${fmt(outer[0].y)}`;
  for (let i = 1; i < outer.length; i++) d += ` L${fmt(outer[i].x)} ${fmt(outer[i].y)}`;
  for (let i = inner.length - 1; i >= 0; i--) d += ` L${fmt(inner[i].x)} ${fmt(inner[i].y)}`;
  return `${d} Z`;
}

function lerpSample(a: RibbonSample, b: RibbonSample, t: number): RibbonSample {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    halfW: lerp(a.halfW, b.halfW, t),
    ox: lerp(a.ox, b.ox, t),
    oy: lerp(a.oy, b.oy, t),
    ix: lerp(a.ix, b.ix, t),
    iy: lerp(a.iy, b.iy, t),
  };
}

function buildRibbonSamples(
  centerline: Point3D[],
  minHalfW: number,
  maxHalfW: number,
  zRange: number
): RibbonSample[] {
  const n = centerline.length;
  return centerline.map((pt, i) => {
    const prev = centerline[(i - 1 + n) % n];
    const next = centerline[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const t = (pt.z + zRange) / (2 * zRange);
    const halfW = lerp(minHalfW, maxHalfW, t);
    return {
      ...pt,
      halfW,
      ox: pt.x + nx * halfW,
      oy: pt.y + ny * halfW,
      ix: pt.x - nx * halfW,
      iy: pt.y - ny * halfW,
    };
  });
}

function splitRibbonArcs(samples: RibbonSample[]): { backArcs: RibbonSample[][]; frontArcs: RibbonSample[][] } {
  const n = samples.length;
  const runs: Array<{ sign: number; pts: RibbonSample[] }> = [];

  for (let i = 0; i < n; i++) {
    const curr = samples[i];
    const next = samples[(i + 1) % n];
    const sign = curr.z >= 0 ? 1 : -1;
    const last = runs[runs.length - 1];

    if (last && last.sign === sign) {
      last.pts.push(curr);
    } else {
      runs.push({ sign, pts: [curr] });
    }

    if ((curr.z >= 0) !== (next.z >= 0)) {
      const denom = Math.abs(curr.z) + Math.abs(next.z);
      const t = denom > 0 ? Math.abs(curr.z) / denom : 0.5;
      const cross = lerpSample(curr, next, t);
      runs[runs.length - 1].pts.push(cross);

      const nextSign = next.z >= 0 ? 1 : -1;
      runs.push({ sign: nextSign, pts: [cross] });
    }
  }

  if (runs.length > 1 && runs[0].sign === runs[runs.length - 1].sign) {
    const first = runs.shift()!;
    runs[runs.length - 1].pts.push(...first.pts);
  }

  const backArcs: RibbonSample[][] = [];
  const frontArcs: RibbonSample[][] = [];

  for (const run of runs) {
    if (run.pts.length < 2) continue;
    if (run.sign < 0) backArcs.push(run.pts);
    else frontArcs.push(run.pts);
  }

  return { backArcs, frontArcs };
}

function arcsToPath(arcs: RibbonSample[][]): string {
  return arcs
    .map((arc) => {
      const outer = arc.map((p) => ({ x: p.ox, y: p.oy }));
      const inner = arc.map((p) => ({ x: p.ix, y: p.iy }));
      return ribbonPathFromArc(outer, inner);
    })
    .filter(Boolean)
    .join(' ');
}

function buildRingRibbon(
  size: number,
  cx: number,
  cy: number,
  spin: number,
  radius: number,
  tilt: number,
  samples: number,
  minHalfW: number,
  maxHalfW: number,
  rotation: number
): AtomRibbon {
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const cosS = Math.cos(spin);
  const sinS = Math.sin(spin);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const zRange = radius * sinT;

  const centerline: Point3D[] = [];
  for (let s = 0; s < samples; s++) {
    const a = (s / samples) * Math.PI * 2;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    const ty = py * cosT;
    const tz = py * sinT;
    const sx = px * cosS - ty * sinS;
    const sy = px * sinS + ty * cosS;
    const rx = sx * cosR - sy * sinR;
    const ry = sx * sinR + sy * cosR;
    centerline.push({ x: cx + rx, y: cy - ry, z: tz });
  }

  const ribbonSamples = buildRibbonSamples(centerline, minHalfW, maxHalfW, zRange);
  const { backArcs, frontArcs } = splitRibbonArcs(ribbonSamples);

  const far = centerline.reduce((best, p) => (p.z < best.z ? p : best), centerline[0]);
  const near = centerline.reduce((best, p) => (p.z > best.z ? p : best), centerline[0]);

  return {
    backPath: arcsToPath(backArcs),
    frontPath: arcsToPath(frontArcs),
    grad: { x1: far.x, y1: far.y, x2: near.x, y2: near.y },
  };
}

function buildSphereRim(
  cx: number,
  cy: number,
  sphereR: number,
  brightAngle: number,
  maxHalfW: number,
  exponent: number,
  arcHalfRad: number,
  minHalfWRatio: number,
  samples: number
): { strokes: RimStroke[] } {
  const r = sphereR;
  const minHalfW = maxHalfW * minHalfWRatio;
  const strokes: RimStroke[] = [];

  for (let s = 0; s < samples; s++) {
    const t0 = s / samples;
    const t1 = (s + 1) / samples;
    const theta0 = brightAngle - arcHalfRad + t0 * (2 * arcHalfRad);
    const theta1 = brightAngle - arcHalfRad + t1 * (2 * arcHalfRad);
    const thetaMid = (theta0 + theta1) / 2;
    const taper = Math.max(0, 0.5 + 0.5 * Math.cos(thetaMid - brightAngle));
    const halfW = Math.max(minHalfW, maxHalfW * Math.pow(taper, exponent));

    const x1 = cx + r * Math.cos(theta0);
    const y1 = cy + r * Math.sin(theta0);
    const x2 = cx + r * Math.cos(theta1);
    const y2 = cy + r * Math.sin(theta1);

    strokes.push({
      d: `M${fmt(x1)} ${fmt(y1)} L${fmt(x2)} ${fmt(y2)}`,
      width: halfW * 2,
    });
  }

  return { strokes };
}

function buildSphereLight(cx: number, cy: number, sphereR: number): SphereLight {
  return {
    diffuseCx: cx - sphereR * 0.3,
    diffuseCy: cy - sphereR * 0.34,
    diffuseR: sphereR * 0.75,
    specCx: cx - sphereR * 0.2,
    specCy: cy - sphereR * 0.24,
    specR: sphereR * 0.26,
  };
}

/** Global rotation of the whole atom, in degrees (clockwise / "to the right"). */
export const ATOM_ROTATION_DEG = 90;

/**
 * Yaw (degrees) added to the two inclined orbits (indices 1 and 2) so their
 * intersection points lie on the fixed vertical orbit (index 0, spin 0).
 */
export const ATOM_INCLINED_ORBIT_YAW_DEG = 61;

export function buildAtomRibbons(size: number): AtomGeometry {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;
  const tilt = (72 * Math.PI) / 180;
  const scale = size / 112;
  const minHalfW = scale * 0.45;
  const maxHalfW = scale * 1.35;
  const samples = 120;
  const rotation = -(ATOM_ROTATION_DEG * Math.PI) / 180;
  const inclinedYaw = (ATOM_INCLINED_ORBIT_YAW_DEG * Math.PI) / 180;

  const ribbons = [0, 1, 2].map((i) => {
    const spin = i === 0 ? 0 : -(i * 60 * Math.PI) / 180 + inclinedYaw;
    return buildRingRibbon(
      size,
      cx,
      cy,
      spin,
      radius,
      tilt,
      samples,
      minHalfW,
      maxHalfW,
      rotation
    );
  });

  const rimBrightAngle = (ATOM_SHADING.rimBrightAngleDeg * Math.PI) / 180;
  const arcHalfRad = (ATOM_SHADING.rimArcHalfDeg * Math.PI) / 180;
  const sphereR = size * 0.46;
  const rimMaxHalfW = size * ATOM_SHADING.rimMaxHalfW;
  const rim = buildSphereRim(
    cx,
    cy,
    sphereR,
    rimBrightAngle,
    rimMaxHalfW,
    ATOM_SHADING.rimExponent,
    arcHalfRad,
    ATOM_SHADING.rimMinHalfWRatio,
    96
  );
  const sphereLight = buildSphereLight(cx, cy, sphereR);

  return {
    cx,
    cy,
    coreR: size * 0.072,
    haloR: sphereR,
    sphereR,
    ribbons,
    rim,
    sphereLight,
  };
}
