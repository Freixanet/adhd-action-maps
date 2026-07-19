# Liquid Glass (iOS 26+)

Native iOS Liquid Glass for **floating UI only**, via [`expo-glass-effect`](https://docs.expo.dev/versions/latest/sdk/glass-effect/).

## Files changed

| File | Role |
|------|------|
| `mobile/src/components/LiquidGlassSurface.tsx` | Core wrapper: `GlassView` on iOS 26+, fallback `View` elsewhere |
| `mobile/src/components/LiquidGlassMotionShell.tsx` | Composer motion: Reanimated scale/ring/sheen + native glass focus |
| `mobile/src/hooks/useGlassAccessibility.ts` | Reduce Motion + Reduce Transparency subscription |
| `mobile/src/logic/glassAvailability.ts` | Runtime native glass availability checks |
| `mobile/src/components/GlassSurface.tsx` | Adds `liquid` + `borderRadius`; floating surfaces opt in |
| `mobile/src/components/ComposerSurface.tsx` | Composer dock (liquid + motion shell) |
| `mobile/src/components/FloatingGlassButton.tsx` | Floating profile / Nuevo mapa buttons |
| `mobile/src/components/AttachMenu.tsx` | Attach popup menu |
| `mobile/src/components/ProfileMenu.tsx` | Account menu panel |
| `mobile/src/components/HistoryEntryGlassMenu.tsx` | History entry context menu |
| `mobile/src/components/ModelChip.tsx` | Mode picker sheet chrome |
| `mobile/src/components/MapChatSheet.tsx` | Sheet header + bottom composer chrome |
| `mobile/src/components/AuthSheet.tsx` | Sheet header chrome |
| `mobile/src/components/IntentSelector.tsx` | Entender / Aplicar segmented control |
| `mobile/package.json` | `expo-glass-effect` dependency |

## What uses Liquid Glass

- Composer input container (`ComposerSurface`)
- Floating buttons (`FloatingGlassButton` — neutral tone only; accent stays solid indigo)
- Attach menu, profile menu, history entry menu, intent selector
- Modal/sheet chrome (ModelChip picker, MapChat, Auth headers + MapChat bottom bar)

## What does **not** use Liquid Glass

- Screen backgrounds (`SafeAreaView`, drawers, scroll areas)
- History cards, chat bubbles, index rows
- Accent “Nuevo mapa” pill (solid color by design)

## How to test (iOS 26 simulator or device)

1. **Rebuild dev client required** — `expo-glass-effect` adds native code; Expo Go / an old dev build will not show real glass.
   ```bash
   cd mobile
   npm run ios:prebuild   # or eas build --profile preview --platform ios
   npm run ios:device     # install on device/simulator
   ```
2. Start preview bridge from main checkout:
   ```bash
   cd /Users/mfreixanet/antigravity/Untitled
   npm run mobile:preview
   ```
3. Mac LAN IP:
   ```bash
   ipconfig getifaddr en0
   ```
4. On iPhone (same WiFi), open dev build → connect to `http://<IP-LAN-MAC>:8082`
5. Check:
   - Composer at bottom of input/result screens looks like native glass over content
   - Floating circle/pill buttons in sidebar footer
   - Attach menu popup, profile menu, mode sheet
   - Map chat header + bottom input bar
6. **Accessibility:** Settings → Accessibility → Display → *Reduce Transparency* ON → app should show solid/semi-solid fallbacks, no crash.

## Android / older iOS

- Same layouts and hit targets
- `LiquidGlassSurface` renders a sober semi-opaque `View` with subtle border (existing blur path via `GlassSurface` when `liquid={false}`)
- No Liquid Glass material, no behavior change to navigation or scroll

## Motion (composer only)

Composer micro-interaction is **wrapper/overlay motion**, not a material swap. The glass stays **`regular` + constant tint** in idle and focus — no `regular` → `clear` transition (that darkened the composer).

| Layer | Technology | What it does |
|-------|------------|--------------|
| Material | **Native** `GlassView` | Stable `regular` style; `isInteractive` while focused only |
| Pulse trigger | **RN** `Pressable` + focus | `onPressIn` on shell **and** `TextInput` focus; debounced haptic |
| Expansion | **Reanimated** outer wrapper | Peak `scale` ~1.018 → settle `1.006` focused / `1.0` idle |
| Ring | **Reanimated** overlay above glass | 1px luminous border, ~260ms flash, does not tint the fill |
| Sheen | **Reanimated** overlay above glass | Diagonal band ~180ms, clipped to `borderRadius`, low opacity |
| Fallback | **RN `View`** | Solid composer surface; Android unchanged |

**Never animated:** `GlassView` opacity or any parent opacity (expo #41024).

**Accessibility**

- **Reduce Motion:** no scale/sheen; optional static ring at low opacity while focused; `isInteractive` off
- **Reduce Transparency:** native glass disabled → fallback `View` path

Wiring: `TextInput` `onFocus`/`onBlur` → `ComposerSurface focused={…}`; `inputRef` lets tapping composer chrome focus the field and fire the same pulse.

## Known limitations

- Liquid Glass is **iOS 26+ only**; guarded with `Platform.Version`, `isGlassEffectAPIAvailable()`, `isLiquidGlassAvailable()`, and Reduce Transparency.
- Requires **new native dev build** after installing the package.
- Do not animate opacity on glass wrappers (press states apply to outer `Pressable`, not `GlassView`).
- `GlassView` must not cover full-screen backgrounds — only contained floating regions.
