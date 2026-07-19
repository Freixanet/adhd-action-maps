const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
      }

      const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (pathMatch) return pathMatch[1];
    }
  } catch {
    if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;
  }

  return null;
}

export function isYouTubeUrl(text: string): boolean {
  return extractYouTubeVideoId(text) !== null;
}
