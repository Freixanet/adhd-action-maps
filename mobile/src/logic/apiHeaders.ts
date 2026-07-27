import { getOrCreateInstallId } from './installId';

/**
 * Headers for LLM API calls: always send install id; attach Bearer when logged in.
 */
export async function buildLlmRequestHeaders(
  accessToken?: string | null
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Install-Id': await getOrCreateInstallId(),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}
