import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BG_BASE, ACCENT, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import type { CausalFlowSpec } from '@shared/visualizeCompiler';
import type { VisualizeArtifact, VisualizeRouteA, VisualizeRouteC } from '../logic/contracts';

type NucleoVisualizeWebViewProps = {
  artifact: VisualizeArtifact;
  compact?: boolean;
  onOpenStep?: (stepId: string) => void;
  style?: StyleProp<ViewStyle>;
};

function escapeForScript(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function buildCausalFlowHtml(spec: CausalFlowSpec, compact: boolean): string {
  const payload = escapeForScript(JSON.stringify(spec));
  const minH = compact ? 360 : 480;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  :root { --bg:${BG_BASE}; --accent:${ACCENT}; --text:${TEXT_PRIMARY}; --body:${TEXT_BODY}; --muted:${TEXT_SECONDARY}; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin:0; padding:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
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
    flex:1; min-height:40px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);
    background:rgba(255,255,255,0.05); color:var(--body); font-size:13px; font-weight:600;
    padding:10px 8px;
  }
  .scenario.active {
    border-color: rgba(139,143,245,0.55); background:rgba(139,143,245,0.18); color:var(--text);
  }
  .step {
    width:100%; text-align:left; border:0; border-radius:16px;
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
    padding:14px 14px; color:inherit;
  }
  .step.open { border-color: rgba(139,143,245,0.45); background:rgba(139,143,245,0.12); }
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
    background:rgba(224,180,92,0.08); border:1px solid rgba(224,180,92,0.28);
  }
  #caveat.on { display:block; }
  #caveat-label {
    margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:0.08em;
    text-transform:uppercase; color:#E0B45C;
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
  compact: boolean
): string {
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
  body{margin:0;padding:8px;background:${BG_BASE};color:${TEXT_PRIMARY};font-family:-apple-system,system-ui,sans-serif;min-height:${minH}px}
  h1{font-size:17px;line-height:1.35;margin:0 0 12px}
  .row{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);margin:0 0 8px;font-size:14px;line-height:1.35}
  .meta{font-size:12px;color:${TEXT_SECONDARY};margin-top:4px}
  .caveat{margin-top:14px;padding:12px;border-radius:14px;background:rgba(224,180,92,.08);border:1px solid rgba(224,180,92,.28);font-size:13px;color:${TEXT_BODY}}
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

function buildRouteAHtml(artifact: VisualizeArtifact, chosen: VisualizeRouteA, compact: boolean): string {
  if (chosen.grammar === 'causal-flow') {
    const spec = chosen.spec as unknown as CausalFlowSpec;
    if (spec && Array.isArray(spec.steps) && spec.steps.length >= 2) {
      return buildCausalFlowHtml(spec, compact);
    }
  }
  return buildGenericStructuredHtml(artifact, chosen, compact);
}

function buildRouteCHtml(chosen: VisualizeRouteC, compact: boolean): string {
  const initial = escapeForScript(JSON.stringify(chosen.initialState ?? {}));
  const minH = compact ? 300 : 440;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
<style>
  html, body { margin:0; padding:0; background:${BG_BASE}; color:${TEXT_PRIMARY}; font-family:-apple-system,system-ui,sans-serif; min-height:${minH}px; }
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
    el.style.cssText = 'color:#E07A6B;padding:12px;font-size:13px;';
    el.textContent = 'Error en la miniaplicación.';
    document.body.appendChild(el);
  }
  window.__visualizePost({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

function buildArtifactHtml(artifact: VisualizeArtifact, compact: boolean): string {
  if (artifact.chosen.route === 'adhoc') {
    return buildRouteCHtml(artifact.chosen, compact);
  }
  return buildRouteAHtml(artifact, artifact.chosen, compact);
}

export default function NucleoVisualizeWebView({
  artifact,
  compact = false,
  onOpenStep,
  style,
}: NucleoVisualizeWebViewProps) {
  const html = useMemo(() => buildArtifactHtml(artifact, compact), [artifact, compact]);
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
      style={[styles.shell, compact ? styles.compact : styles.full, style]}
      accessibilityLabel={a11y}
    >
      <Text style={styles.srOnly}>{a11y}</Text>
      <WebView
        key={`${artifact.chosen.grammar}:${artifact.semantic.centralIdea}:${artifact.chosen.route}`}
        originWhitelist={['*']}
        source={{ html, baseUrl: '' }}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        style={styles.webview}
        containerStyle={styles.webview}
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: BG_BASE,
  },
  full: { minHeight: 480 },
  compact: { minHeight: 380 },
  webview: {
    flex: 1,
    backgroundColor: BG_BASE,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
