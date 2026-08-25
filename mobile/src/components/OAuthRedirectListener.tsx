import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useAppSession } from '../context/AppSessionContext';
import { completeOAuthRedirect } from '../logic/cloudHistory';
import { supabase } from '../logic/supabase';

export default function OAuthRedirectListener() {
  const setError = useAppSession().setError;

  useEffect(() => {
    // Web: supabase.auth detectSessionInUrl handles ?code= on load. Clean the URL after.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const href = window.location.href;
      if (href.includes('code=') || href.includes('access_token=')) {
        void supabase?.auth
          .getSession()
          .then(() => {
            window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'No se pudo completar el acceso.');
          });
      }
      return;
    }

    const handleRedirect = (url: string) => {
      void completeOAuthRedirect(url).catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo completar el acceso.');
      });
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleRedirect(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) handleRedirect(url);
    });

    return () => subscription.remove();
  }, [setError]);

  return null;
}
