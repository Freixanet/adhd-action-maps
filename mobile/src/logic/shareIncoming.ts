/**
 * Inbound share / deep-link helpers for the Expo client.
 * Full iOS Share Extension needs a native target + App Group after prebuild;
 * until then we accept `nucleo://import?url=` and `nucleo://map/:id`.
 */

import * as Linking from 'expo-linking';
import {
  parseNucleoIncomingUrl,
  SHARE_EXTENSION_CONTRACT,
  type IncomingShare,
} from '@shared/shareIncoming';

export {
  parseNucleoIncomingUrl,
  SHARE_EXTENSION_CONTRACT,
  type IncomingShare,
};

export function nucleoMapDeepLink(entryId: string): string {
  return Linking.createURL(`map/${entryId}`);
}
