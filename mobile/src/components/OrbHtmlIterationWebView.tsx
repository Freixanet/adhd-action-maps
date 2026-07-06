import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { BG_BASE } from '@shared/uiTokens';

type OrbHtmlIterationWebViewProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  reduceMotion?: boolean;
  /** Allow tap inside WebView to cycle HTML background presets. Default true. */
  interactive?: boolean;
};

/** Stage = orb × 1.9 per iteration HTML spec. */
export function orbIterationCanvasDimension(orbSize: number): number {
  return Math.round(orbSize * 1.9);
}

/** Matches original CSS dashA/dashB: period 280 viewBox units in 0.7s linear. */
const ORBIT_DASH_SEG = 120;
const ORBIT_DASH_GAP = 160;
const ORBIT_DASH_PERIOD = ORBIT_DASH_SEG + ORBIT_DASH_GAP;
const ORBIT_DASH_OFFSET_STATIC = ORBIT_DASH_PERIOD / 2;

function buildTransparencyInjectedJavaScript(pageBg: string): string {
  return `(function() {
  try {
    document.documentElement.style.backgroundColor = '${pageBg}';
    document.body.style.backgroundColor = '${pageBg}';
  } catch(e) {}
})(); true;`;
}

function buildOrbIterationHtml(orbSize: number, reduceMotion: boolean, pageBg: string): string {
  const reduceClass = reduceMotion ? 'reduce-motion' : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="color-scheme" content="light dark">
<style>
  :root {
    --accent: 139, 143, 245;
    --orb: ${orbSize}px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    background: ${pageBg} !important;
    overflow: hidden;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    font-family: -apple-system, system-ui, sans-serif;
    transition: background 200ms ease;
    cursor: pointer;
  }
  body[data-bg="1"] { background: #17171C !important; }
  body[data-bg="2"] { background: #1F1F26 !important; }
  body[data-bg="3"] { background: #3a3d6e !important; }
  .hint { color: rgba(255,255,255,0.35); font-size: 13px; letter-spacing: 0.06em; pointer-events: none; }

  .stage {
    position: relative;
    width: calc(var(--orb) * 1.9);
    height: calc(var(--orb) * 1.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .levitation {
    position: relative;
    width: var(--orb);
    height: var(--orb);
    animation: levitation 4s ease-in-out infinite;
  }

  .ambient {
    position: absolute;
    inset: -14%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--accent), 0.14) 0%, transparent 68%);
    animation: ambient 4s ease-in-out infinite;
  }

  .glass {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0) 50%, rgba(0,0,0,0.05));
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,0.14),
      inset 0 2px 1.5px rgba(255,255,255,0.7),
      inset 3px 6px 14px rgba(255,255,255,0.14),
      inset -6px -12px 22px rgba(0,0,0,0.55),
      inset 0 -2px 3px rgba(var(--accent), 0.30),
      inset 0 0 22px rgba(var(--accent), 0.10),
      0 0 26px rgba(var(--accent), 0.08);
  }

  .swirl-wrap {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    overflow: hidden;
    z-index: 1;
  }

  .glass::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: inset 0 0 10px 2px rgba(255,255,255,0.05);
  }

  .specular {
    position: absolute;
    top: 6%;
    left: 12%;
    width: 52%;
    height: 30%;
    border-radius: 50%;
    transform: rotate(-24deg);
    z-index: 3;
    background: radial-gradient(ellipse at 45% 45%,
      rgba(255,255,255,0.65) 0%,
      rgba(255,255,255,0.18) 30%,
      rgba(255,255,255,0.04) 55%,
      rgba(255,255,255,0) 70%);
    filter: blur(3px);
  }

  .counterlight {
    position: absolute;
    bottom: 12%;
    right: 15%;
    width: 22%;
    height: 10%;
    border-radius: 50%;
    transform: rotate(-18deg);
    z-index: 3;
    background: radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%);
  }

  .swirl {
    position: absolute;
    inset: -8%;
    border-radius: 50%;
    background: conic-gradient(from 0deg,
      transparent 0%,
      rgba(var(--accent), 0.20) 40%,
      transparent 60%);
    mix-blend-mode: screen;
    filter: blur(7px);
    opacity: 0.3;
    animation: swirl 4s linear infinite;
  }

  .orbits { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  .orbits svg { width: 100%; height: 100%; overflow: visible; mix-blend-mode: screen; }
  .o { fill: none; stroke-linecap: round; stroke-dasharray: ${ORBIT_DASH_SEG} ${ORBIT_DASH_GAP}; }
  .o-halo { stroke: rgba(var(--accent), 0.22); stroke-width: 14; filter: url(#glowWide); }
  .o-core { stroke: rgba(198, 201, 255, 0.85); stroke-width: 5; filter: url(#glowTight); }
  .spin-a { animation: dashA 0.7s linear infinite; }
  .spin-b { animation: dashB 0.7s linear infinite; }

  .nucleus {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 30%;
    height: 30%;
    margin: -15% 0 0 -15%;
    z-index: 3;
    background: linear-gradient(135deg, #dde3ff 0%, #9ba0f8 55%, #3b357e 100%);
    filter: blur(1px);
    box-shadow: 0 0 26px rgba(var(--accent), 0.7);
    animation: nucleus 3.5s ease-in-out infinite;
  }

  .floor-shadow {
    position: absolute;
    bottom: 6%;
    left: 50%;
    width: 56%;
    height: 7%;
    margin-left: -28%;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    filter: blur(5px);
    animation: floorShadow 4s ease-in-out infinite;
  }

  @keyframes levitation {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-11px); }
  }
  @keyframes ambient {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.07); opacity: 1; }
  }
  @keyframes swirl { to { transform: rotate(360deg); } }
  @keyframes dashA {
    from { stroke-dashoffset: ${ORBIT_DASH_PERIOD}; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes dashB {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: ${ORBIT_DASH_PERIOD}; }
  }
  @keyframes nucleus {
    0%, 100% {
      border-radius: 44% 56% 62% 38% / 46% 52% 48% 54%;
      transform: scale(0.88) rotate(0deg);
      opacity: 0.72;
    }
    50% {
      border-radius: 58% 42% 38% 62% / 52% 58% 42% 48%;
      transform: scale(1.04) rotate(178deg);
      opacity: 0.95;
    }
  }
  @keyframes floorShadow {
    0%, 100% { transform: scale(1); opacity: 0.55; }
    50% { transform: scale(0.78); opacity: 0.28; }
  }

  .reduce-motion .levitation { animation: none; transform: translateY(0); }
  .reduce-motion .ambient { animation: none; opacity: 0.8; transform: scale(1); }
  .reduce-motion .swirl { animation: none; transform: rotate(0deg); }
  .reduce-motion .spin-a,
  .reduce-motion .spin-b { animation: none; }
  .reduce-motion .o { stroke-dashoffset: ${ORBIT_DASH_OFFSET_STATIC}; }
  .reduce-motion .nucleus {
    animation: none;
    border-radius: 44% 56% 62% 38% / 46% 52% 48% 54%;
    transform: scale(0.92) rotate(0deg);
    opacity: 0.82;
  }
  .reduce-motion .floor-shadow { animation: none; transform: scale(0.88); opacity: 0.4; }
</style>
</head>
<body class="${reduceClass}" data-bg="0" onclick="this.dataset.bg = (Number(this.dataset.bg) + 1) % 4">
  <div class="stage">
    <div class="floor-shadow"></div>
    <div class="levitation">
      <div class="ambient"></div>
      <div class="glass">
        <div class="swirl-wrap"><div class="swirl"></div></div>
        <div class="orbits">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="fadeX" gradientUnits="userSpaceOnUse" x1="3" y1="0" x2="197" y2="0">
                <stop offset="0" stop-color="#000"/>
                <stop offset="0.10" stop-color="#fff"/>
                <stop offset="0.90" stop-color="#fff"/>
                <stop offset="1" stop-color="#000"/>
              </linearGradient>
              <mask id="edgeFade"><rect x="-20" y="-20" width="240" height="240" fill="url(#fadeX)"/></mask>
              <filter id="glowWide" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="6.5"/>
              </filter>
              <filter id="glowTight" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="b"/>
                <feMerge>
                  <feMergeNode in="b"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <g transform="rotate(35 100 100)">
              <g mask="url(#edgeFade)">
                <ellipse class="o o-halo spin-a" cx="100" cy="100" rx="97" ry="36"/>
                <ellipse class="o o-core spin-a" cx="100" cy="100" rx="97" ry="36"/>
              </g>
            </g>
            <g transform="rotate(-45 100 100)">
              <g mask="url(#edgeFade)">
                <ellipse class="o o-halo spin-b" cx="100" cy="100" rx="97" ry="36"/>
                <ellipse class="o o-core spin-b" cx="100" cy="100" rx="97" ry="36"/>
              </g>
            </g>
            <g transform="rotate(80 100 100)">
              <g mask="url(#edgeFade)">
                <ellipse class="o o-halo spin-a" cx="100" cy="100" rx="97" ry="36"/>
                <ellipse class="o o-core spin-a" cx="100" cy="100" rx="97" ry="36"/>
              </g>
            </g>
          </svg>
        </div>
        <div class="nucleus"></div>
        <div class="specular"></div>
        <div class="counterlight"></div>
      </div>
    </div>
  </div>
  <div class="hint">tap fondo</div>
</body>
</html>`;
}

/** Dev/reference WebView for the glass-iteration HTML prototype (Fresnel insets, counterlight, dual orbit strokes). */
export default function OrbHtmlIterationWebView({
  size = 96,
  style,
  reduceMotion = false,
  interactive = true,
}: OrbHtmlIterationWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const canvas = orbIterationCanvasDimension(size);
  const pageBg = BG_BASE;
  const html = useMemo(
    () => buildOrbIterationHtml(size, reduceMotion, pageBg),
    [reduceMotion, size, pageBg]
  );
  const transparencyFixJS = useMemo(() => buildTransparencyInjectedJavaScript(pageBg), [pageBg]);

  const commonWebViewProps = {
    source: { html, baseUrl: 'https://localhost' },
    style: [styles.webview, { width: canvas, height: canvas }],
    containerStyle: styles.webviewContainer,
    scrollEnabled: false as const,
    bounces: false,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    automaticallyAdjustContentInsets: false,
    originWhitelist: ['*'] as string[],
    javaScriptEnabled: true,
    domStorageEnabled: false,
    incognito: true,
    overScrollMode: 'never' as const,
    nestedScrollEnabled: false,
    pointerEvents: (interactive ? 'auto' : 'none') as 'auto' | 'none',
    allowsBackForwardNavigationGestures: false,
    backgroundColor: pageBg,
    injectedJavaScript: transparencyFixJS,
  };

  return (
    <View
      style={[styles.shell, { width: canvas, height: canvas }, style]}
      pointerEvents={interactive ? 'auto' : 'none'}
      collapsable={false}
    >
      {Platform.OS === 'ios' ? (
        <WebView
          ref={webViewRef}
          {...commonWebViewProps}
          dataDetectorTypes="none"
          allowsLinkPreview={false}
          contentInsetAdjustmentBehavior="never"
          injectedJavaScriptBeforeContentLoaded={transparencyFixJS}
          injectedJavaScript={transparencyFixJS}
        />
      ) : (
        <WebView ref={webViewRef} {...commonWebViewProps} androidLayerType="hardware" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    alignSelf: 'center',
  },
  webviewContainer: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
