/**
 * Nucleo editorial scene markup — single source for RN SvgXml and visual QA.
 *
 * Family: nucleo-editorial-silhouette-v1
 * License: nucleo-local (authored for Nucleo; no third-party attribution required)
 *
 * Heroes/comparisons/sequences are path-based editorial compositions.
 * Streamline Public API is icons-only (UX Line); spots may enrich when keyed.
 */

export type EditorialSceneKey =
  | 'progress-summit'
  | 'enemies-triptych'
  | 'self-handicap'
  | 'attention-drain'
  | 'interruptors-triptych';

const C = {
  accent: '#8B8FF5',
  matiz: '#E0B45C',
  alerta: '#E07A6B',
  primary: '#FAFAFA',
  body: '#D4D4DC',
  secondary: '#9CA0AB',
  surface: '#24262D',
  base: '#181A1F',
} as const;

export function editorialSceneMarkup(sceneKey: EditorialSceneKey): string {
  switch (sceneKey) {
    case 'progress-summit':
      return PROGRESS_SUMMIT;
    case 'enemies-triptych':
      return ENEMIES_TRIPTYCH;
    case 'self-handicap':
      return SELF_HANDICAP;
    case 'attention-drain':
      return ATTENTION_DRAIN;
    case 'interruptors-triptych':
      return INTERRUPTORS;
    default:
      return PROGRESS_SUMMIT;
  }
}

export function editorialSceneViewBox(sceneKey: EditorialSceneKey): { w: number; h: number } {
  switch (sceneKey) {
    case 'progress-summit':
      return { w: 360, h: 292 };
    case 'enemies-triptych':
      return { w: 360, h: 240 };
    case 'self-handicap':
      return { w: 360, h: 210 };
    case 'attention-drain':
      return { w: 360, h: 268 };
    case 'interruptors-triptych':
      return { w: 360, h: 240 };
    default:
      return { w: 360, h: 292 };
  }
}

/** Side-profile walker with pack — organic silhouette masses. */
const WALKER = `
  <g fill="${C.primary}">
    <path d="M78 148c1.2-11.6 9.4-19.8 20.8-20.6 8.8-.6 16.4 4.2 19.6 12.2 1.8 4.4.6 8.8-2.8 11.6-3.6 3-8.8 3.8-14.2 2.6-9.2-2-17.2-8.4-20.6-16.2-.8-1.8-1.6-3.6-2.8 10.4z"/>
    <path d="M74 166c-.8 4.2.4 8.4 3.6 11.2 4.8 4.2 12.2 5.6 19.4 4.2 9.6-1.8 17.8-8.4 21.6-17.2 1.4-3.2 1.6-6.4.4-9.2-8.2 6.4-18.4 9.6-28.6 8.8-5.6-.4-11.2-2.2-16.4-5.4v7.6z"/>
    <path d="M88 182c-2.4 18.4-1.2 34.8 5.6 48.4 1.2 2.4 3.6 3.6 6.2 3.2l8.4-1.2c2.2-.4 3.6-2.4 3.2-4.6-2.8-14.4-3.6-28.2-2.4-42.2 9.8 5.6 18.6 14.8 23.4 26.8l11.8-6.2c-7.2-17.8-21.4-30.6-38.2-35.4-6.2-1.8-12.8-1.2-18 1.2z"/>
    <path d="M96 226c-3.2 12.8-7.6 24.8-14.2 35.6-.8 1.4.2 3.2 1.8 3.4l12.6 1.6c1.6.2 3-1 3.4-2.6 3.2-11.6 7.8-22.6 13.4-33.2z"/>
    <path d="M112 228c1.6 12.4 5.2 24.2 11.4 34.8.8 1.4 2.6 1.8 3.8.8l10.4-8.2c1.2-1 .8-2.8-.6-3.4-8.6-3.8-14.8-12.4-18.2-22.6z"/>
    <path d="M108 176c-8.4 4.2-17.2 6.8-26.2 7.6-2.2.2-3.6 2.4-2.8 4.4l5.6 12.4c.6 1.4 2.2 2 3.6 1.4 10.2-4.2 19.4-10.6 27-18.6z"/>
  </g>
  <path d="M118 168c8.2-2.4 16.4-6.2 23.6-11.4 1.6-1.2 1.4-3.6-.4-4.4l-10.8-4.6c-1.4-.6-3 .2-3.6 1.6-3.6 7.4-8.6 13.8-14.8 18.8z" fill="${C.accent}"/>
  <path d="M124 158c7.6-4.8 14.2-11.2 19.2-18.8.8-1.2.2-2.8-1.2-3.2l-9.4-2.6c-1.4-.4-2.8.6-3.2 2-2.4 7.8-6.2 14.8-11.4 20.6z" fill="${C.accent}" opacity=".9"/>
  <path d="M70 178l-16 58" stroke="${C.body}" stroke-width="2.6" stroke-linecap="round"/>
`;

const PROGRESS_SUMMIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 292" fill="none">
  <defs>
    <linearGradient id="sky" x1="180" y1="0" x2="180" y2="292" gradientUnits="userSpaceOnUse">
      <stop stop-color="${C.accent}" stop-opacity=".32"/>
      <stop offset=".42" stop-color="${C.base}" stop-opacity=".4"/>
      <stop offset="1" stop-color="${C.base}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="peak" x1="222" y1="36" x2="200" y2="250" gradientUnits="userSpaceOnUse">
      <stop stop-color="${C.accent}" stop-opacity=".62"/>
      <stop offset=".55" stop-color="${C.accent}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${C.accent}" stop-opacity=".12"/>
    </linearGradient>
  </defs>
  <rect width="360" height="292" fill="url(#sky)"/>
  <circle cx="298" cy="54" r="38" fill="${C.matiz}" fill-opacity=".1"/>
  <circle cx="298" cy="54" r="17" fill="${C.matiz}"/>
  <!-- Far landforms -->
  <path d="M-10 178c36-26 68-18 104-44 28-20 52-14 82-34 26-18 50-12 74-28 22-14 48-10 70-22l50 10v120H-10z" fill="${C.secondary}" fill-opacity=".16"/>
  <path d="M0 204c44-30 84-16 128-42 40-24 74-8 116-32 30-18 58-12 80-24l36 8v98H0z" fill="${C.accent}" fill-opacity=".15"/>
  <!-- Irregular summit (not a pure triangle) -->
  <path d="M132 252c18-46 34-92 46-138 4-16 10-28 18-28 6 0 12 8 18 24 10 28 22 70 36 118 8 28 18 52 28 74H132z" fill="url(#peak)"/>
  <path d="M176 114c8-22 16-40 22-40 4 0 10 12 16 32l-10 8-12-22-10 18z" fill="${C.primary}" fill-opacity=".88"/>
  <path d="M196 74c2-10 6-18 10-18 3 0 7 6 11 16l-7 6-6-10-5 8z" fill="${C.primary}"/>
  <path d="M206 56v-24" stroke="${C.secondary}" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M206 32l36 15-36 15z" fill="${C.matiz}"/>
  <circle cx="206" cy="40" r="26" fill="${C.matiz}" fill-opacity=".1"/>
  <!-- Switchback -->
  <path d="M18 256c42-18 70-36 96-56 30-24 50-42 78-68 22-20 42-38 64-58" stroke="${C.matiz}" stroke-width="8" stroke-opacity=".2" fill="none" stroke-linecap="round"/>
  <path d="M18 256c42-18 70-36 96-56 30-24 50-42 78-68 22-20 42-38 64-58" stroke="${C.matiz}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="1 9"/>
  <!-- Foreground shelf -->
  <path d="M0 248c46-16 82-8 126-22 40-12 76-6 118-16 38-10 74-6 116-14v96H0z" fill="${C.surface}" fill-opacity=".6"/>
  <path d="M42 228l7-22 7 22z" fill="${C.accent}" fill-opacity=".32"/>
  <path d="M318 214l9-28 9 28z" fill="${C.accent}" fill-opacity=".26"/>
  ${WALKER}
</svg>`;

const ENEMIES_TRIPTYCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" fill="none">
  <rect width="360" height="240" rx="20" fill="${C.surface}" fill-opacity=".75"/>
  <path d="M0 176c68-18 140 10 220-12 52-14 94-4 140-8v84H0z" fill="${C.accent}" fill-opacity=".1"/>
  <path d="M120 42v150" stroke="${C.secondary}" stroke-opacity=".16" stroke-width="1.5" stroke-dasharray="3 7"/>
  <path d="M240 42v150" stroke="${C.secondary}" stroke-opacity=".16" stroke-width="1.5" stroke-dasharray="3 7"/>

  <!-- Delay: open goal, figure leaving -->
  <path d="M22 160V68h46v92" stroke="${C.accent}" stroke-width="2.8" fill="${C.accent}" fill-opacity=".1"/>
  <path d="M68 68l34 14v78H68z" fill="${C.matiz}" fill-opacity=".24" stroke="${C.matiz}" stroke-width="2.2"/>
  <circle cx="90" cy="118" r="5.5" fill="${C.matiz}"/>
  <g fill="${C.primary}">
    <path d="M112 96c1-10.4 8.6-17.6 18.4-18 7.6-.4 14.4 4.2 16.8 11.4 1.4 4.2.2 8.2-2.8 10.6-3.2 2.6-8 3.2-12.8 2-8.4-2-15.6-8.2-18.4-16-.4-1.2-.8-2.4-1.2 10z"/>
    <path d="M118 118c-1.6 16.8-.4 32 5.2 44.8h12.6c1.8-14.2 2.2-27.2 3.2-40.2 8.6 4.8 15.8 13.6 19.6 24.4l12.2-5.6c-5.6-16.4-17.4-28.2-31.4-32.4-5.4-1.6-11.6-.6-21.4 1z"/>
    <path d="M126 162l-8.4 36h14.2l5-22 6.8 22h15.2l-12.2-36z"/>
  </g>
  <path d="M110 210h48" stroke="${C.alerta}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M146 198l16 12-16 12" stroke="${C.alerta}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Perfection: star above cracked base, reach -->
  <path d="M186 52l11 28 30 4-24 20 7 30-24-15-24 15 7-30-24-20 30-4z" fill="${C.matiz}"/>
  <path d="M172 142h52l14 56H158z" fill="${C.accent}" fill-opacity=".2" stroke="${C.accent}" stroke-width="2.2"/>
  <path d="M198 142l-12 56M198 142l14 56" stroke="${C.alerta}" stroke-width="2.3"/>
  <path d="M152 198h92" stroke="${C.alerta}" stroke-width="3" stroke-linecap="round"/>
  <g fill="${C.primary}">
    <path d="M198 116c5.6-1.8 12 .6 15.2 6.4 2.2 3.8 1.6 8-.8 10.6-2.8 3-7.8 4-13 2.8-7-.8-12.8-5.6-13.8-11.4-.4-2.4 2.4-6.2 12.4-8.4z"/>
    <path d="M188 132c-.8 10 .6 20 4.6 28h11c2-10 3-18 4-26 6.4 2.4 11 8.4 13.4 15l11-4.2c-3.6-12.4-13-21-24.2-23.4-4.4-.8-8.8-.2-19.8 2.6z"/>
  </g>
  <path d="M214 134l20-24" stroke="${C.alerta}" stroke-width="2.3" stroke-linecap="round"/>
  <circle cx="238" cy="104" r="4" fill="${C.alerta}"/>

  <!-- Plans without motion -->
  <rect x="256" y="60" width="82" height="20" rx="6" fill="${C.accent}" fill-opacity=".48"/>
  <rect x="262" y="86" width="82" height="20" rx="6" fill="${C.accent}" fill-opacity=".36"/>
  <rect x="268" y="112" width="82" height="20" rx="6" fill="${C.accent}" fill-opacity=".24"/>
  <rect x="274" y="138" width="82" height="20" rx="6" fill="${C.secondary}" fill-opacity=".3"/>
  <path d="M286 70h22M292 96h22M298 122h16" stroke="${C.primary}" stroke-opacity=".4" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M318 166v24" stroke="${C.secondary}" stroke-width="2.5" stroke-dasharray="4 5"/>
  <circle cx="318" cy="206" r="14" stroke="${C.alerta}" stroke-width="3" fill="${C.alerta}" fill-opacity=".16"/>
  <path d="M306 206h24" stroke="${C.alerta}" stroke-width="3.2" stroke-linecap="round"/>
</svg>`;

const SELF_HANDICAP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 210" fill="none">
  <rect x="12" y="48" width="44" height="88" rx="22" fill="${C.accent}" fill-opacity=".12" stroke="${C.accent}" stroke-width="2.5"/>
  <path d="M34 70v36M22 88h24" stroke="${C.matiz}" stroke-width="3" stroke-linecap="round"/>
  <rect x="64" y="48" width="44" height="88" rx="22" fill="${C.alerta}" fill-opacity=".26" stroke="${C.alerta}" stroke-width="3.1"/>
  <path d="M76 92h20" stroke="${C.alerta}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M86 144v16" stroke="${C.alerta}" stroke-width="2.5"/>
  <path d="M76 152l10 10 10-10" stroke="${C.alerta}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <path d="M120 88h20" stroke="${C.secondary}" stroke-width="2.3"/>
  <path d="M132 81l12 7-12 7" stroke="${C.secondary}" stroke-width="2.3" fill="none"/>

  <g fill="${C.primary}">
    <path d="M154 60c1-11 9-18.8 20-19.2 8.2-.4 15.4 4.6 17.8 12.6 1.4 4.6.2 8.8-3 11.4-3.4 2.8-8.6 3.4-13.8 2.2-9-2-16.8-8.8-19.6-17.4-.4-1.4-1-2.6-1.4 10.4z"/>
    <path d="M160 84c-2 18.8-.8 35.6 5.4 50.2h13.4c2-16.4 2.8-31 4.2-45.4 10.2 5.2 19 15.4 24 28l13.4-6c-7.4-19.8-22.4-33.2-39.6-37.2-5.8-1.4-12.2-.4-20.8 2.4z"/>
    <path d="M168 134l-9.4 38h15.2l5.4-23 7.4 23h16.2l-12.8-38z"/>
  </g>
  <rect x="200" y="44" width="36" height="114" rx="9" fill="${C.matiz}" fill-opacity=".16" stroke="${C.matiz}" stroke-width="2.7"/>
  <path d="M210 66h18M210 90h18M210 114h14M210 138h10" stroke="${C.secondary}" stroke-width="2.3" stroke-linecap="round"/>
  <path d="M218 24v20" stroke="${C.alerta}" stroke-width="2.7" stroke-linecap="round"/>
  <path d="M206 36l12-14 12 14" stroke="${C.alerta}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <path d="M250 88h18" stroke="${C.secondary}" stroke-width="2.3"/>
  <path d="M260 81l12 7-12 7" stroke="${C.secondary}" stroke-width="2.3" fill="none"/>

  <g fill="${C.primary}">
    <path d="M280 74c1-10 8.4-17.2 18-17.6 7.4-.4 14 4 16.4 11.2 1.4 4 .2 7.8-2.8 10.2-3 2.4-7.6 3-12.4 2-8-1.8-15-8-17.6-15.6-.4-1.2-.8-2.4-1.6 9.8z"/>
    <path d="M286 96c-1.6 16.4-.6 31.2 4.2 44h12.8c1.8-14.4 2.4-27.2 3.6-40 8.4 4.4 15.2 13 18.8 23.2l12.2-5.4c-5.4-15.8-16.8-27-31-30.8-5-1.4-10.8-.4-20.6 2z"/>
  </g>
  <path d="M304 36h48c7 0 12 5 12 12v36c0 7-5 12-12 12h-30l-16 18 7-18h-9c-7 0-12-5-12-12V48c0-7 5-12 12-12z" fill="${C.alerta}" fill-opacity=".22" stroke="${C.alerta}" stroke-width="2.5"/>
  <path d="M314 56h36M314 72h28" stroke="${C.alerta}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M320 124c10 12 10 12 20 0" stroke="${C.alerta}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>`;

const ATTENTION_DRAIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 268" fill="none">
  <ellipse cx="180" cy="116" rx="90" ry="96" fill="${C.accent}" fill-opacity=".14" stroke="${C.accent}" stroke-width="2.7"/>
  <ellipse cx="180" cy="108" rx="38" ry="42" fill="${C.accent}" fill-opacity=".44"/>
  <path d="M180 108L48 32" stroke="${C.alerta}" stroke-width="3.3"/>
  <path d="M180 108L104 18" stroke="${C.matiz}" stroke-width="2.7"/>
  <path d="M180 108L256 16" stroke="${C.matiz}" stroke-width="2.7"/>
  <path d="M180 108L318 36" stroke="${C.alerta}" stroke-width="3.3"/>
  <path d="M180 108L340 122" stroke="${C.secondary}" stroke-width="2.3"/>
  <path d="M180 108L24 128" stroke="${C.secondary}" stroke-width="2.3"/>
  <circle cx="48" cy="32" r="14" fill="${C.alerta}"/>
  <circle cx="318" cy="36" r="14" fill="${C.alerta}"/>
  <circle cx="104" cy="18" r="11" fill="${C.matiz}"/>
  <circle cx="256" cy="16" r="11" fill="${C.matiz}"/>
  <g fill="${C.primary}">
    <path d="M180 192c1.2-11 9.6-19 21-19.4 8.6-.4 16.2 4.8 18.8 13.2 1.4 4.6.2 9-3.2 11.6-3.6 2.8-9 3.6-14.6 2.4-9.4-2-17.6-9.2-20.6-18.2-.4-1.4-1-2.8-1.4 10.4z"/>
    <path d="M168 216c-2 16.8-.8 32 4.8 45.2h13.6c2-14.8 2.8-28.2 4.4-41.4 9.8 4.6 18 14 22.8 25.4l13.2-5.8c-7-18.6-21-31.4-37.4-35.4-5.6-1.4-11.8-.4-21.4 2z"/>
  </g>
</svg>`;

const INTERRUPTORS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" fill="none">
  <rect width="360" height="240" rx="20" fill="${C.surface}" fill-opacity=".75"/>
  <path d="M0 176c68-18 140 10 220-12 52-14 94-4 140-8v84H0z" fill="${C.accent}" fill-opacity=".1"/>
  <path d="M120 42v150" stroke="${C.secondary}" stroke-opacity=".16" stroke-width="1.5" stroke-dasharray="3 7"/>
  <path d="M240 42v150" stroke="${C.secondary}" stroke-opacity=".16" stroke-width="1.5" stroke-dasharray="3 7"/>
  <circle cx="70" cy="112" r="36" stroke="${C.alerta}" stroke-width="2.6" fill="${C.alerta}" fill-opacity=".12"/>
  <circle cx="70" cy="112" r="15" fill="${C.alerta}"/>
  <rect x="152" y="78" width="52" height="74" rx="12" fill="${C.accent}" fill-opacity=".2" stroke="${C.accent}" stroke-width="2.5"/>
  <rect x="174" y="66" width="52" height="74" rx="12" fill="${C.matiz}" fill-opacity=".22" stroke="${C.matiz}" stroke-width="2.5"/>
  <path d="M164 166h60" stroke="${C.alerta}" stroke-width="2.7" stroke-linecap="round"/>
  <path d="M266 88c30-10 52 10 52 36s-22 46-52 36" stroke="${C.secondary}" stroke-width="2.7" fill="none"/>
  <path d="M266 88v74" stroke="${C.accent}" stroke-width="3.1" stroke-linecap="round"/>
  <circle cx="266" cy="162" r="11" fill="${C.alerta}" fill-opacity=".85"/>
</svg>`;
