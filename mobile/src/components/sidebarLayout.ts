import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.76, 340);
export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const DRAWER_SPAN = SCREEN_WIDTH - DRAWER_WIDTH;

/** Circle glass buttons in the sidebar header (lupa, etc.). */
export const SIDEBAR_HEADER_BUTTON_SIZE = 36;

/** Horizontal padding (24×2) + gap (8) + trailing button (36). */
export const SIDEBAR_SEARCH_SLOT_INSET = 48 + 8 + 36;

export function sidebarSearchSlotWidth(drawerWidth: number) {
  return Math.max(0, drawerWidth - SIDEBAR_SEARCH_SLOT_INSET);
}

export const FULL_SEARCH_SLOT = sidebarSearchSlotWidth(SCREEN_WIDTH);
export const COMPACT_SEARCH_SLOT = sidebarSearchSlotWidth(DRAWER_WIDTH);

export function searchSlotWidthFromClip(clipWidth: number) {
  'worklet';
  return Math.max(0, clipWidth - SIDEBAR_SEARCH_SLOT_INSET);
}

/** Corner radius for the main sheet when drawer is open. */
export const MAIN_SHEET_CORNER_RADIUS = Math.round(
  Math.min(Math.max(Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.138, 52), 62)
);
