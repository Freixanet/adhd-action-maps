import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_ID_KEY = 'nucleo.installId';

function createInstallId(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  // Fallback when randomUUID is unavailable (rare on current RN).
  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-install id for anon LLM quota (`X-Install-Id`). */
export async function getOrCreateInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (existing?.trim()) return existing.trim();
  } catch {
    // Fall through and mint a new id.
  }

  const id = createInstallId();
  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, id);
  } catch {
    // Still send the ephemeral id this session.
  }
  return id;
}
