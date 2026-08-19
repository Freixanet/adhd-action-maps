import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { BG_BASE } from '@shared/uiTokens';
import { color, motion, shadow } from '@shared/design-tokens';

type ExactLiquidOrbWebViewProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  reduceMotion?: boolean;
};

function canvasDimension(orbSize: number): number {
  return Math.round(Math.max(orbSize * 2.6, orbSize + 140));
}

function buildOrbHtml(orbSize: number, reduceMotion: boolean, pageBg: string): string {
  const reduceClass = reduceMotion ? 'reduce-motion' : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html,
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${pageBg} !important;
      overflow: visible;
      -webkit-text-size-adjust: 100%;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #root,
    .stage,
    .orb-stage,
    .orb-container {
      background: ${pageBg} !important;
      border: none;
      outline: none;
      box-shadow: none;
    }
    .stage,
    .orb-stage {
      position: relative;
      width: ${orbSize}px;
      height: ${orbSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
    .levitation-wrapper,
    .orb-container {
      position: relative;
      width: ${orbSize}px;
      height: ${orbSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      animation: levitation ${motion.orbLevitation.duration}ms ease-in-out infinite;
      will-change: transform;
    }
    .ambient-glow {
      position: absolute;
      inset: -15%;
      border-radius: 50%;
      background: ${color.orb.ambient};
      filter: blur(16px);
      -webkit-filter: blur(16px);
      animation: ambient-glow ${motion.orbLevitation.duration}ms ease-in-out infinite;
      will-change: transform, opacity;
      pointer-events: none;
    }
    .glass-shell {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      overflow: hidden;
      z-index: 10;
      clip-path: circle(50% at 50% 50%);
      -webkit-mask-image: -webkit-radial-gradient(white, black);
      transform: translateZ(0);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: radial-gradient(
        circle at 30% 30%,
        ${color.orb.glassHighlight} 0%,
        ${color.orb.glassAccent} 50%,
        ${color.orb.glassDepth} 100%
      );
      box-shadow:
        inset 4px 4px 12px ${color.orb.glassSpecular},
        inset -8px -8px 24px ${color.orb.glassInsetDark},
        inset 0 0 24px ${color.orb.glassGlow},
        0 10px 30px ${color.background.overlay};
    }
    .specular {
      position: absolute;
      top: 10%;
      left: 18%;
      width: 40%;
      height: 20%;
      border-radius: 50%;
      background: ${color.orb.glassSpecular};
      filter: blur(2px);
      -webkit-filter: blur(2px);
      transform: rotate(-25deg);
      z-index: 30;
      pointer-events: none;
    }
    .swirl {
      position: absolute;
      inset: -10%;
      border-radius: 50%;
      opacity: 0.7;
      mix-blend-mode: screen;
      filter: blur(6px);
      -webkit-filter: blur(6px);
      z-index: 10;
      background: conic-gradient(from 0deg, transparent, ${color.orb.swirl} 40%, transparent 60%);
      animation: swirl-rotate ${motion.orbLevitation.duration}ms linear infinite;
      will-change: transform;
      pointer-events: none;
    }
    .orbits {
      position: absolute;
      inset: -15%;
      z-index: 10;
      mix-blend-mode: screen;
      pointer-events: none;
    }
    .orbits svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      opacity: 1;
    }
    .orbit-1 {
      animation: orbit-dash-a ${motion.orbOrbit.duration}ms linear infinite;
    }
    .orbit-2 {
      animation: orbit-dash-b ${motion.orbOrbit.duration}ms linear infinite;
    }
    .orbit-3 {
      animation: orbit-dash-a ${motion.orbOrbit.duration}ms linear infinite;
    }
    .caustics {
      position: absolute;
      top: -${Math.round((orbSize / 96) * 16)}px;
      left: -${Math.round((orbSize / 96) * 16)}px;
      width: ${Math.round((orbSize / 96) * 112)}px;
      height: ${Math.round((orbSize / 96) * 112)}px;
      border-radius: 50%;
      background: ${color.orb.caustics};
      filter: blur(24px);
      -webkit-filter: blur(24px);
      mix-blend-mode: screen;
      z-index: 10;
      animation: caustics-spin ${motion.orbCaustics.duration}ms linear infinite;
      will-change: transform;
      pointer-events: none;
    }
    .nucleus {
      position: absolute;
      inset: 35%;
      z-index: 10;
      background: linear-gradient(to top right, ${color.orb.nucleusLight}, ${color.action.primary}, ${color.orb.nucleusDark});
      filter: blur(5px);
      -webkit-filter: blur(5px);
      box-shadow: 0 0 24px ${color.orb.swirl};
      animation: nucleus-morph ${motion.orbNucleus.duration}ms ease-in-out infinite;
      will-change: transform, opacity, border-radius;
      pointer-events: none;
    }
    .levitation-shadow {
      position: absolute;
      bottom: -${Math.round((orbSize / 96) * 24)}px;
      left: 50%;
      width: ${Math.round((orbSize / 96) * 64)}px;
      height: ${Math.round((orbSize / 96) * 8)}px;
      margin-left: -${Math.round((orbSize / 96) * 32)}px;
      background: ${color.orb.shadow};
      border-radius: 9999px;
      filter: blur(4px);
      -webkit-filter: blur(4px);
      animation: levitation-shadow ${motion.orbLevitation.duration}ms ease-in-out infinite;
      will-change: transform, opacity;
      pointer-events: none;
    }

    @keyframes levitation {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
    @keyframes ambient-glow {
      0%, 100% { transform: scale(1); opacity: 0.15; }
      50% { transform: scale(1.08); opacity: 0.35; }
    }
    @keyframes swirl-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes orbit-dash-a {
      from { stroke-dashoffset: 140; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes orbit-dash-b {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: 140; }
    }
    @keyframes caustics-spin {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(-180deg) scale(1.15); }
      100% { transform: rotate(-360deg) scale(1); }
    }
    @keyframes nucleus-morph {
      0%, 100% {
        transform: scale(0.85) rotate(0deg);
        opacity: 0.6;
        border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
      }
      50% {
        transform: scale(1.05) rotate(180deg);
        opacity: 0.9;
        border-radius: 60% 40% 30% 70% / 50% 60% 40% 50%;
      }
    }
    @keyframes levitation-shadow {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(0.8); opacity: 0.1; }
    }

    .reduce-motion .levitation-wrapper {
      animation: none;
      transform: translateY(0);
    }
    .reduce-motion .ambient-glow {
      animation: none;
      transform: scale(1);
      opacity: 0.25;
    }
    .reduce-motion .swirl {
      animation: none;
      transform: rotate(0deg);
    }
    .reduce-motion .orbit-1,
    .reduce-motion .orbit-2,
    .reduce-motion .orbit-3 {
      animation: none;
    }
    .reduce-motion .orbit-1 { stroke-dashoffset: 70; }
    .reduce-motion .orbit-2 { stroke-dashoffset: 70; }
    .reduce-motion .orbit-3 { stroke-dashoffset: 70; }
    .reduce-motion .caustics {
      animation: none;
      transform: rotate(0deg) scale(1);
    }
    .reduce-motion .nucleus {
      animation: none;
      transform: scale(0.95) rotate(0deg);
      opacity: 0.75;
      border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
    }
    .reduce-motion .levitation-shadow {
      animation: none;
      transform: scale(0.9);
      opacity: 0.2;
    }
  </style>
</head>
<body class="${reduceClass}">
  <div id="root">
    <div class="stage orb-stage">
      <div class="levitation-wrapper orb-container">
      <div class="ambient-glow"></div>
      <div class="glass-shell">
        <div class="specular"></div>
        <div class="swirl"></div>
        <div class="orbits">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <filter id="energy-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="core" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="glow1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="glow2" />
                <feMerge>
                  <feMergeNode in="glow2" />
                  <feMergeNode in="glow1" />
                  <feMergeNode in="core" />
                </feMerge>
              </filter>
            </defs>
            <ellipse
              class="orbit-1"
              cx="50" cy="50" rx="38" ry="14"
              fill="none"
              stroke="${color.orb.orbit}"
              stroke-width="4"
              stroke-dasharray="60 80"
              stroke-linecap="round"
              transform="rotate(35 50 50)"
              filter="url(#energy-glow)"
            />
            <ellipse
              class="orbit-2"
              cx="50" cy="50" rx="38" ry="14"
              fill="none"
              stroke="${color.orb.orbit}"
              stroke-width="4"
              stroke-dasharray="60 80"
              stroke-linecap="round"
              transform="rotate(-45 50 50)"
              filter="url(#energy-glow)"
            />
            <ellipse
              class="orbit-3"
              cx="50" cy="50" rx="38" ry="14"
              fill="none"
              stroke="${color.orb.orbit}"
              stroke-width="4"
              stroke-dasharray="60 80"
              stroke-linecap="round"
              transform="rotate(80 50 50)"
              filter="url(#energy-glow)"
            />
          </svg>
        </div>
        <div class="caustics"></div>
        <div class="nucleus"></div>
      </div>
    </div>
      <div class="levitation-shadow"></div>
    </div>
  </div>
</body>
</html>`;
}

export default function ExactLiquidOrbWebView({
  size = 96,
  style,
  reduceMotion = false,
}: ExactLiquidOrbWebViewProps) {
  const canvas = canvasDimension(size);
  const pageBg = BG_BASE;
  const html = useMemo(() => buildOrbHtml(size, reduceMotion, pageBg), [reduceMotion, size, pageBg]);

  const commonWebViewProps = {
    source: { html, baseUrl: '' },
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
    pointerEvents: 'none' as const,
    allowsBackForwardNavigationGestures: false,
    backgroundColor: pageBg,
  };

  /** Force WKWebView scroll-view backgrounds to clear after page load. */
  const transparencyFixJS = `
    try {
      document.documentElement.style.backgroundColor = '${pageBg}';
      document.body.style.backgroundColor = '${pageBg}';
    } catch(e) {}
    true;
  `;

  return (
    <View
      style={[
        styles.shell,
        {
          width: canvas,
          height: canvas,
          backgroundColor: pageBg,
        },
        style,
      ]}
      pointerEvents="none"
      collapsable={false}
    >
      {Platform.OS === 'ios' ? (
        <WebView
          {...commonWebViewProps}
          opaque={false}
          dataDetectorTypes="none"
          allowsLinkPreview={false}
          contentInsetAdjustmentBehavior="never"
          injectedJavaScriptBeforeContentLoaded={transparencyFixJS}
          injectedJavaScript={transparencyFixJS}
        />
      ) : (
        <WebView {...commonWebViewProps} androidLayerType="hardware" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    borderWidth: 0,
    ...shadow.none,
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
