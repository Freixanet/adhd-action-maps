let nativeShellReady = false;

export function isNativeShell(): boolean {
  return false;
}

export async function initNativeShell(): Promise<void> {
  nativeShellReady = true;
}
