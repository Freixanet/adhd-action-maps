import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useAppSession } from '../context/AppSessionContext';

const PREVIEW_LOADING_PATH = 'dev/preview-loading';

function isPreviewLoadingUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes(PREVIEW_LOADING_PATH) ||
    normalized.includes('preview-loading')
  );
}

/**
 * DEV: `nucleo://dev/preview-loading` opens the LoadingScreen preview
 * (same as Attach → Preview colección) for automated QA without UIMenu taps.
 */
export default function DevPreviewDeepLink() {
  const previewLoadingScreen = useAppSession().previewLoadingScreen;

  useEffect(() => {
    if (!__DEV__ || !previewLoadingScreen) return;

    const handle = (url: string) => {
      if (isPreviewLoadingUrl(url)) {
        previewLoadingScreen();
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    return () => sub.remove();
  }, [previewLoadingScreen]);

  return null;
}
