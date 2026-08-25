export type HomeSurface = 'chat' | 'nucleo';

export const HOME_SURFACE_OPTIONS = [
  { id: 'chat', label: 'Chat' },
  { id: 'nucleo', label: 'Núcleo' },
] as const;

export const DEFAULT_HOME_SURFACE: HomeSurface = 'nucleo';

export const HOME_SURFACE_LAYOUT = {
  trackPad: 3,
  segmentWidth: 84,
  trackHeight: 44,
} as const;

export const HOME_SURFACE_TRACK_WIDTH =
  HOME_SURFACE_LAYOUT.segmentWidth * 2 + HOME_SURFACE_LAYOUT.trackPad * 2;

export const HOME_SURFACE_THUMB_HEIGHT =
  HOME_SURFACE_LAYOUT.trackHeight - HOME_SURFACE_LAYOUT.trackPad * 2;

export const HOME_SURFACE_THUMB_TRAVEL = HOME_SURFACE_LAYOUT.segmentWidth;

export const HOME_SURFACE_TEST_IDS = {
  root: 'home-surface-segment',
  trackSurface: 'home-surface-segment-track',
  thumbSurface: 'home-surface-segment-thumb',
  optionChat: 'home-surface-segment-chat',
  optionNucleo: 'home-surface-segment-nucleo',
} as const;

export function homeSurfaceToIndex(surface: HomeSurface): 0 | 1 {
  return surface === 'nucleo' ? 1 : 0;
}

export function indexToHomeSurface(index: number): HomeSurface {
  return index >= 1 ? 'nucleo' : 'chat';
}

export function resolveHomeSurfaceCommit(args: {
  current: HomeSurface;
  nextIndex: number;
}): { surface: HomeSurface; index: 0 | 1; changed: boolean } {
  const index = (args.nextIndex >= 1 ? 1 : 0) as 0 | 1;
  const surface = indexToHomeSurface(index);
  return { surface, index, changed: surface !== args.current };
}

export function shouldAnimateHomeSurfaceThumb(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function homeSurfacePlaceholder(surface: HomeSurface): string {
  return surface === 'chat' ? 'Escribe una pregunta' : 'Pega caos, recibe un Núcleo';
}

export function homeSurfaceAccessibilityLabel(surface: HomeSurface): string {
  return surface === 'chat' ? 'Chat' : 'Núcleo';
}
