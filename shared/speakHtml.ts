/** Offline HTML that speaks `text` via the WebView speech engine. */
export function buildSpeakHtml(text: string): string {
  const payload = JSON.stringify(text).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><script>
(function(){
  var text = ${payload};
  if (!text || !window.speechSynthesis) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('unavailable');
    return;
  }
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.onend = function(){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('end'); };
  u.onerror = function(){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('end'); };
  window.speechSynthesis.speak(u);
})();
</script></body></html>`;
}
