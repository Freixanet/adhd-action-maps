import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useAppSession } from '../context/AppSessionContext';
import { completeOAuthRedirect } from '../logic/cloudHistory';

export default function OAuthRedirectListener() {
  const setError = useAppSession().setError;

  useEffect(() => {
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
