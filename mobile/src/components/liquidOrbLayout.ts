/** Layout math extracted from ExactLiquidOrbWebView buildOrbHtml() CSS. */

export function canvasDimension(orbSize: number): number {
  return Math.round(Math.max(orbSize * 2.6, orbSize + 140));
}

/**
 * Three.js orb WebView: the orb fills the whole page and the glass sphere
 * covers ~67% of the viewport (radius 1.55, camera z 5.2, fov 50).
 * canvas = size/0.67 keeps the visible sphere ≈ `displaySize` with wide
 * margins so native-side misalignment can never clip the sphere. Layout
 * footprint stays `displaySize`; the WebView is absolutely centered around it.
 */
export function nucleoOrbWebViewLayout(displaySize: number) {
  const canvas = Math.round(displaySize * 1.5);
  const bleed = Math.round((canvas - displaySize) / 2);
  return { canvas, bleed, displaySize };
}

export type LiquidOrbLayout = {
  canvas: number;
  stageOffset: number;
  cx: number;
  cy: number;
  r: number;
  glowR: number;
  swirlR: number;
  orbitScale: number;
  specularCx: number;
  specularCy: number;
  specularW: number;
  specularH: number;
  causticsCx: number;
  causticsCy: number;
  causticsR: number;
  nucleusSize: number;
  shadowCx: number;
  shadowCy: number;
  shadowW: number;
  shadowH: number;
  glassGradientCx: number;
  glassGradientCy: number;
};

export function liquidOrbLayout(orbSize: number): LiquidOrbLayout {
  const canvas = canvasDimension(orbSize);
  const stageOffset = (canvas - orbSize) / 2;
  const cx = canvas / 2;
  const cy = canvas / 2;
  const r = orbSize / 2;

  const glowR = (orbSize * 1.3) / 2;
  const swirlR = (orbSize * 1.2) / 2;
  const orbitScale = (orbSize * 1.3) / 100;

  const specularW = orbSize * 0.52;
  const specularH = orbSize * 0.3;
  const specularX = stageOffset + orbSize * 0.12;
  const specularY = stageOffset + orbSize * 0.06;

  const causticsOffset = (orbSize / 96) * 16;
  const causticsSize = (orbSize / 96) * 112;
  const causticsCx = stageOffset - causticsOffset + causticsSize / 2;
  const causticsCy = stageOffset - causticsOffset + causticsSize / 2;

  const nucleusSize = orbSize * (1 - 2 * 0.35);

  const shadowW = (orbSize / 96) * 64;
  const shadowH = (orbSize / 96) * 8;
  const shadowBottomOffset = (orbSize / 96) * 24;
  const shadowCx = cx;
  const shadowCy = stageOffset + orbSize + shadowBottomOffset - shadowH / 2;

  const glassGradientCx = stageOffset + orbSize * 0.3;
  const glassGradientCy = stageOffset + orbSize * 0.3;

  return {
    canvas,
    stageOffset,
    cx,
    cy,
    r,
    glowR,
    swirlR,
    orbitScale,
    specularCx: specularX + specularW / 2,
    specularCy: specularY + specularH / 2,
    specularW,
    specularH,
    causticsCx,
    causticsCy,
    causticsR: causticsSize / 2,
    nucleusSize,
    shadowCx,
    shadowCy,
    shadowW,
    shadowH,
    glassGradientCx,
    glassGradientCy,
  };
}

/** CSS border-radius percentages for nucleus-morph keyframes (0% / 50% / 100%). */
export function nucleusCornerRadii(
  size: number,
  progress: number
): { tlX: number; tlY: number; trX: number; trY: number; brX: number; brY: number; blX: number; blY: number } {
  'worklet';
  const lerp3 = (a: number, b: number, c: number, t: number) => {
    if (t <= 0.5) return a + (b - a) * (t / 0.5);
    return b + (c - b) * ((t - 0.5) / 0.5);
  };

  return {
    tlX: lerp3(0.4, 0.6, 0.4, progress) * size,
    trX: lerp3(0.6, 0.4, 0.6, progress) * size,
    brX: lerp3(0.7, 0.3, 0.7, progress) * size,
    blX: lerp3(0.3, 0.7, 0.3, progress) * size,
    tlY: lerp3(0.4, 0.5, 0.4, progress) * size,
    trY: lerp3(0.5, 0.6, 0.5, progress) * size,
    brY: lerp3(0.6, 0.4, 0.6, progress) * size,
    blY: lerp3(0.5, 0.5, 0.5, progress) * size,
  };
}
