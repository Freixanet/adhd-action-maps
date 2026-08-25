/**
 * Composer glass experiments. Each switch is independent: flip any one back to
 * `false` and that step reverts on its own, no rebuild needed.
 */

/**
 * Wraps the composer in a `UIGlassContainerEffect` so the send button's glass
 * merges with the bar instead of stacking glass on glass, with UIKit animating
 * the morph. `false` keeps the two surfaces separate.
 */
export const COMPOSER_GLASS_CONTAINER = true;

/**
 * Feeds `borderRadius` to GlassView so UIKit's `cornerConfiguration` shapes
 * the capsule. Do not JS-clip (`overflow: hidden`): that shears the lensed ends
 * and the bar reads as a flat rectangle.
 */
export const COMPOSER_NATIVE_CORNERS = true;

/**
 * Drops the JS ornaments — scale pulse, sheen sweep, touch glow and the SVG
 * perimeter ring — and leans on UIKit's interactive glass instead.
 *
 * Stays on at rest and while focused so a press on the capsule has the same
 * elastic response in both states. Content is hosted inside the glass view so
 * the first tap still reaches the field.
 */
export const COMPOSER_NATIVE_INTERACTIVE_ONLY = true;

/**
 * Puts the composer's content *inside* the native glass view instead of layering
 * it over a background sibling. With the effect view as an ancestor, UIKit sees
 * the touches and its interactive glass reacts across the whole bar — the way a
 * natively built composer behaves.
 *
 * The trade-off: the glass can no longer defer its mount or remount on layout,
 * since remounting would tear down the text field and drop the keyboard.
 */
export const COMPOSER_GLASS_HOSTS_CONTENT = true;

/** Distance at which the container starts merging nearby glass shapes. */
export const COMPOSER_GLASS_MERGE_SPACING = 20;
