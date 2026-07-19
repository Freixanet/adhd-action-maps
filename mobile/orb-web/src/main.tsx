import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NucleoOrb, type NucleoOrbState } from './nucleo-orb';

export type NucleoOrbRuntimeConfig = {
  state?: NucleoOrbState;
  glow?: boolean;
  interactive?: boolean;
  reduceMotion?: boolean;
};

declare global {
  interface Window {
    __NUCLEO_ORB__?: NucleoOrbRuntimeConfig;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

function readConfig(): Required<NucleoOrbRuntimeConfig> {
  const incoming = window.__NUCLEO_ORB__ ?? {};
  return {
    state: incoming.state ?? 'thinking',
    glow: incoming.glow ?? false,
    interactive: incoming.interactive ?? false,
    reduceMotion: incoming.reduceMotion ?? false,
  };
}

function OrbHost() {
  const [config, setConfig] = useState(readConfig);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let payload: Partial<NucleoOrbRuntimeConfig> | null = null;
      if (typeof event.data === 'string') {
        try {
          payload = JSON.parse(event.data) as Partial<NucleoOrbRuntimeConfig>;
        } catch {
          return;
        }
      } else if (event.data && typeof event.data === 'object') {
        payload = event.data as Partial<NucleoOrbRuntimeConfig>;
      }
      if (!payload) return;
      setConfig((current) => ({ ...current, ...payload }));
    };

    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage as EventListener);
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'orb-ready' }));
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message', onMessage as EventListener);
    };
  }, []);

  // El orbe llena SIEMPRE el viewport completo: el tamaño visual lo controla
  // el host nativo con las dimensiones del WebView, sin depender de config.
  return (
    <NucleoOrb
      state={config.state}
      glow={config.glow}
      interactive={config.interactive}
      reduceMotion={config.reduceMotion}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<OrbHost />);
}
