import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { CausalFlowSpec } from '@shared/visualizeCompiler';
import type { VisualizeArtifact, VisualizeRouteA, VisualizeRouteC } from '../logic/contracts';
import { themeColor, radius } from '@shared/design-tokens/generated/tokens';
import { useTheme } from '../context/ThemeContext';

type VizPalette = (typeof themeColor)[keyof typeof themeColor];

function vizVars(c: VizPalette) {
  return {
    bg: c.background.canvas,
    accent: c.action.primary,
    text: c.text.primary,
    body: c.text.body,
    muted: c.text.secondary,
    wash05: c.background.whiteFade05,
    wash06: c.background.whiteFade06,
    wash10: c.background.whiteFade10,
    wash12: c.background.whiteFade12,
    accentSofter: c.background.accentSofter,
    accentFade18: c.background.accentFade18,
    accentFade45: c.background.accentFade45,
    accentFade55: c.background.accentFade55,
    matizFade08: c.background.matizFade08,
    matizBorder28: c.background.matizBorder28,
    matiz: c.text.warning,
    alerta: c.text.danger,
  } as const;
}

type NucleoVisualizeWebViewProps = {

  artifact: VisualizeArtifact;
  compact?: boolean;
  onOpenStep?: (stepId: string) => void;
  style?: StyleProp<ViewStyle>;
};

function escapeForScript(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function buildCausalFlowHtml(spec: CausalFlowSpec, compact: boolean, c: VizPalette): string {
  const v = vizVars(c);
  const payload = escapeForScript(JSON.stringify(spec));
  const minH = compact ? 360 : 480;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  :root {
    --bg:${v.bg};
    --accent:${v.accent};
    --text:${v.text};
    --body:${v.body};
    --muted:${v.muted};
    --wash-white-05:${v.wash05};
    --wash-white-06:${v.wash06};
    --wash-white-10:${v.wash10};
    --wash-white-12:${v.wash12};
    --accent-fade-12:${v.accentSofter};
    --accent-fade-18:${v.accentFade18};
    --accent-fade-45:${v.accentFade45};
    --accent-fade-55:${v.accentFade55};
    --matiz-fade-08:${v.matizFade08};
    --matiz-border-28:${v.matizBorder28};
    --matiz:${v.matiz};
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin:0; padding:0; background:var(--bg); color:var(--text);
    font-family: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  }
  #app { padding:4px 2px 12px; min-height:${minH}px; }
  #claim {
    margin:0 0 14px; font-size:17px; font-weight:700; line-height:1.35; color:var(--text);
  }
  #scenarios {
    display:none; gap:8px; margin:0 0 14px;
  }
  #scenarios.on { display:flex; }
  .scenario {
    flex:1; min-height:40px; border-radius:12px; border:1px solid var(--wash-white-12);
    background:var(--wash-white-05); color:var(--body); font-size:13px; font-weight:600;
    padding:10px 8px;
  }
  .scenario.active {
    border-color: var(--accent-fade-55); background:var(--accent-fade-18); color:var(--text);
  }
  .step {
    width:100%; text-align:left; border:0; border-radius:16px;
    background:var(--wash-white-06); border:1px solid var(--wash-white-10);
    padding:14px 14px; color:inherit;
  }
  .step.open { border-color: var(--accent-fade-45); background:var(--accent-fade-12); }
  .step-title {
    margin:0; font-size:15px; font-weight:650; line-height:1.3; color:var(--text);
    white-space:normal; overflow:visible; text-overflow:clip;
  }
  .step-detail {
    display:none; margin:8px 0 0; font-size:13px; line-height:1.4; color:var(--body);
  }
  .step.open .step-detail { display:block; }
  .edge {
    display:flex; flex-direction:column; align-items:center; padding:6px 0 8px;
  }
  .edge-label {
    font-size:12px; font-weight:600; color:var(--accent); text-align:center;
    line-height:1.25; max-width:92%; white-space:normal;
  }
  .edge-arrow { color:var(--muted); font-size:14px; line-height:1; margin-top:2px; }
  #caveat {
    display:none; margin-top:16px; padding:14px; border-radius:16px;
    background:var(--matiz-fade-08); border:1px solid var(--matiz-border-28);
  }
  #caveat.on { display:block; }
  #caveat-label {
    margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:0.08em;
    text-transform:uppercase; color:var(--matiz);
  }
  #caveat-body { margin:0; font-size:13px; line-height:1.4; color:var(--body); }
</style>
</head>
<body>
<div id="app">
  <p id="claim"></p>
  <div id="scenarios"></div>
  <div id="flow"></div>
  <div id="caveat"><p id="caveat-label">Importante</p><p id="caveat-body"></p></div>
</div>
<script>
(function(){
  var spec = ${payload};
  var claimEl = document.getElementById('claim');
  var flowEl = document.getElementById('flow');
  var scenariosEl = document.getElementById('scenarios');
  var caveatEl = document.getElementById('caveat');
  var caveatBody = document.getElementById('caveat-body');
  var openId = null;
  var activeScenario = 0;

  function post(msg){
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e){}
  }

  function currentFlow(){
    if (spec.scenarios && spec.scenarios.length >= 2) {
      return spec.scenarios[activeScenario] || spec.scenarios[0];
    }
    return { claim: spec.claim, steps: spec.steps, relations: spec.relations };
  }

  function relationLabel(from, to, relations){
    for (var i=0;i<(relations||[]).length;i++){
      if (relations[i].from===from && relations[i].to===to) return relations[i].label || 'puede llevar a';
    }
    return 'puede llevar a';
  }

  function render(){
    var flow = currentFlow();
    claimEl.textContent = flow.claim || spec.claim || '';
    flowEl.innerHTML = '';
    var steps = flow.steps || [];
    var relations = flow.relations || [];
    steps.forEach(function(step, index){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'step' + (openId===step.id ? ' open' : '');
      var title = document.createElement('p');
      title.className = 'step-title';
      title.textContent = step.title || '';
      btn.appendChild(title);
      if (step.detail) {
        var detail = document.createElement('p');
        detail.className = 'step-detail';
        detail.textContent = step.detail;
        btn.appendChild(detail);
      }
      btn.onclick = function(){
        openId = openId===step.id ? null : step.id;
        render();
      };
      flowEl.appendChild(btn);
      if (index < steps.length - 1) {
        var edge = document.createElement('div');
        edge.className = 'edge';
        var lab = document.createElement('div');
        lab.className = 'edge-label';
        lab.textContent = relationLabel(step.id, steps[index+1].id, relations);
        var arrow = document.createElement('div');
        arrow.className = 'edge-arrow';
        arrow.textContent = '▼';
        edge.appendChild(lab);
        edge.appendChild(arrow);
        flowEl.appendChild(edge);
      }
    });
  }

  if (spec.interaction && spec.interaction.kind==='scenario-toggle' && spec.scenarios && spec.scenarios.length>=2) {
    scenariosEl.className = 'on';
    spec.scenarios.slice(0,2).forEach(function(sc, idx){
      var b = document.createElement('button');
      b.type='button';
      b.className = 'scenario' + (idx===activeScenario ? ' active' : '');
      b.textContent = sc.label;
      b.onclick = function(){
        activeScenario = idx;
        openId = null;
        Array.prototype.forEach.call(scenariosEl.children, function(child, i){
          child.className = 'scenario' + (i===activeScenario ? ' active' : '');
        });
        render();
        post({ type:'state', scenarioId: sc.id });
      };
      scenariosEl.appendChild(b);
    });
  }

  if (spec.caveat) {
    caveatEl.className = 'on';
    caveatBody.textContent = spec.caveat;
  }

  render();
  post({ type:'ready' });
})();
</script>
</body>
</html>`;
}

function buildGenericStructuredHtml(
  artifact: VisualizeArtifact,
  chosen: VisualizeRouteA,
  compact: boolean,
  c: VizPalette
): string {
  const v = vizVars(c);
  // Non-causal structured views: still prefer readable vertical lists over free canvas.
  const payload = escapeForScript(
    JSON.stringify({
      claim: artifact.semantic.centralIdea,
      caveat: artifact.semantic.caveat,
      grammar: chosen.grammar,
      spec: chosen.spec,
    })
  );
  const minH = compact ? 320 : 420;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  body{margin:0;padding:8px;background:${v.bg};color:${v.text};font-family:ui-rounded,"SF Pro Rounded",-apple-system,system-ui,sans-serif;min-height:${minH}px}
  h1{font-size:17px;line-height:1.35;margin:0 0 12px}
  .row{padding:12px 14px;border-radius:14px;background:${v.wash06};border:1px solid ${v.wash10};margin:0 0 8px;font-size:14px;line-height:1.35}
  .meta{font-size:12px;color:${v.muted};margin-top:4px}
  .caveat{margin-top:14px;padding:12px;border-radius:14px;background:${v.matizFade08};border:1px solid ${v.matizBorder28};font-size:13px;color:${v.body}}
</style></head><body>
<h1 id="claim"></h1><div id="list"></div><div id="caveat" class="caveat" style="display:none"></div>
<script>
(function(){
  var data=${payload};
  document.getElementById('claim').textContent=data.claim||'';
  var list=document.getElementById('list');
  var rows=[];
  if(data.grammar==='chart' && data.spec && data.spec.data){
    rows=data.spec.data.map(function(d){return {t:d.label, m:String(d.value)}});
  } else if(data.grammar==='comparison' && data.spec && data.spec.rows){
    rows=data.spec.rows.map(function(r){
      var t=r.label||r.name||Object.values(r)[0];
      return {t:String(t), m:(data.spec.axes||[]).map(function(a){return a+': '+(r[a]!=null?r[a]:'—')}).join(' · ')};
    });
  } else if(data.spec && data.spec.events){
    rows=data.spec.events.map(function(e){return {t:e.label, m:e.detail||''}});
  } else if(data.spec && data.spec.nodes){
    rows=data.spec.nodes.map(function(n){return {t:n.label, m:n.detail||''}});
  }
  rows.forEach(function(r){
    var el=document.createElement('div'); el.className='row';
    el.textContent=r.t||'';
    if(r.m){ var m=document.createElement('div'); m.className='meta'; m.textContent=r.m; el.appendChild(m); }
    list.appendChild(el);
  });
  if(data.caveat){ var c=document.getElementById('caveat'); c.style.display='block'; c.textContent=data.caveat; }
})();
</script></body></html>`;
}

function buildRouteAHtml(artifact: VisualizeArtifact, chosen: VisualizeRouteA, compact: boolean, c: VizPalette): string {
  if (chosen.grammar === 'causal-flow') {
    const spec = chosen.spec as unknown as CausalFlowSpec;
    if (spec && Array.isArray(spec.steps) && spec.steps.length >= 2) {
      return buildCausalFlowHtml(spec, compact, c);
    }
  }
  return buildGenericStructuredHtml(artifact, chosen, compact, c);
}

function buildRouteCHtml(chosen: VisualizeRouteC, compact: boolean, c: VizPalette): string {
  const v = vizVars(c);
  const initial = escapeForScript(JSON.stringify(chosen.initialState ?? {}));
  const minH = compact ? 300 : 440;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
<style>
  html, body { margin:0; padding:0; background:${v.bg}; color:${v.text}; font-family:ui-rounded,"SF Pro Rounded",-apple-system,system-ui,sans-serif; min-height:${minH}px; }
  #__viz_host { min-height:${minH}px; padding:8px; }
  ${chosen.content.styles}
</style>
</head>
<body>
<div id="__viz_host">${chosen.content.markup}</div>
<script>
(function(){
  window.__VISUALIZE_STATE__ = ${initial};
  window.__visualizePost = function(msg){
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e){}
  };
  try { ${chosen.content.script || ''} } catch (err) {
    var el = document.createElement('p');
    el.style.cssText = ${JSON.stringify(`color:${v.alerta};padding:12px;font-size:13px;`)};
    el.textContent = 'Error en la miniaplicación.';
    document.body.appendChild(el);
  }
  window.__visualizePost({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

function buildArtifactHtml(artifact: VisualizeArtifact, compact: boolean, c: VizPalette): string {
  if (artifact.chosen.route === 'adhoc') {
    return buildRouteCHtml(artifact.chosen, compact, c);
  }
  return buildRouteAHtml(artifact, artifact.chosen, compact, c);
}

export default function NucleoVisualizeWebView({
  artifact,
  compact = false,
  onOpenStep,
  style,
}: NucleoVisualizeWebViewProps) {
  const { colors, scheme } = useTheme();
  const html = useMemo(
    () => buildArtifactHtml(artifact, compact, colors),
    [artifact, compact, colors, scheme]
  );
  const a11y =
    artifact.chosen.route === 'adhoc'
      ? artifact.chosen.accessibility.textAlternative
      : artifact.semantic.centralIdea;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const raw = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          stepId?: string;
        };
        if (raw?.type === 'openStep' && raw.stepId && onOpenStep) {
          onOpenStep(raw.stepId);
        }
      } catch {
        // ignore
      }
    },
    [onOpenStep]
  );

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const { url } = request;
    if (!url || url === 'about:blank') return true;
    if (url.startsWith('data:text/html')) return true;
    return false;
  }, []);

  return (
    <View
      style={[
        styles.shell,
        compact ? styles.compact : styles.full,
        { backgroundColor: colors.background.canvas },
        style,
      ]}
      accessibilityLabel={a11y}
    >
      <Text style={styles.srOnly}>{a11y}</Text>
      <WebView
        key={`${artifact.chosen.grammar}:${artifact.semantic.centralIdea}:${artifact.chosen.route}`}
        originWhitelist={['*']}
        source={{ html, baseUrl: '' }}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        style={[styles.webview, { backgroundColor: colors.background.canvas }]}
        containerStyle={[styles.webview, { backgroundColor: colors.background.canvas }]}
        scrollEnabled
        bounces={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        mixedContentMode="never"
        allowsBackForwardNavigationGestures={false}
        sharedCookiesEnabled={false}
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: radius.vizCard,
    overflow: 'hidden',
  },
  full: { minHeight: 480 },
  compact: { minHeight: 380 },
  webview: {
    flex: 1,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
