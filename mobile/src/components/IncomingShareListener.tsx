/**
 * Product deep-link + notification listeners.
 * Opens a map from `nucleo://map/:id` or incomplete reminder taps.
 * Imports shared URLs into the composer via `nucleo://import?url=`.
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useAppSession } from '../context/AppSessionContext';
import { addIncompleteNotificationResponseListener } from '../logic/incompleteReminder';
import { parseNucleoIncomingUrl } from '../logic/shareIncoming';
import { trackProductEvent } from '@shared/productTelemetry';

export default function IncomingShareListener() {
  const { handleSelectHistory, handleComposerTextChange } = useAppSession();

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const incoming = parseNucleoIncomingUrl(url);
      if (!incoming) return;
      if (incoming.kind === 'map') {
        trackProductEvent('continue_open', { via: 'deeplink' });
        handleSelectHistory(incoming.entryId);
        return;
      }
      if (incoming.kind === 'url') {
        handleComposerTextChange(incoming.url);
        return;
      }
      if (incoming.kind === 'text') {
        handleComposerTextChange(incoming.text);
      }
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));

    const notifSub = addIncompleteNotificationResponseListener((entryId) => {
      trackProductEvent('continue_open', { via: 'notification' });
      handleSelectHistory(entryId);
    });

    return () => {
      sub.remove();
      notifSub?.remove();
    };
  }, [handleComposerTextChange, handleSelectHistory]);

  return null;
}
