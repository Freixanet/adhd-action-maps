/** Offline HTML that copies `text` via execCommand — no native clipboard module. */
export function buildCopyHtml(text: string): string {
  const payload = JSON.stringify(text).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<textarea id="t"></textarea>
<script>
(function(){
  var text = ${payload};
  var t = document.getElementById('t');
  t.value = text;
  t.setAttribute('readonly', 'readonly');
  t.style.position = 'fixed';
  t.style.left = '0';
  t.style.top = '0';
  t.style.opacity = '0';
  t.contentEditable = 'true';
  t.focus();
  t.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(ok ? 'ok' : 'fail');
})();
</script></body></html>`;
}
