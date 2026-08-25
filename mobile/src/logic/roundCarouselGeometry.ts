/** Originkit Round Carousel radius: `(width * (1 + spacing * 0.15)) / (2 * tan(π / count))`. */
export function roundCarouselRadius(imageWidth: number, count: number, spacing = 3): number {
  if (count < 2) return 0;
  const factor = 1 + spacing * 0.15;
  return (imageWidth * factor) / (2 * Math.tan(Math.PI / count));
}

export const ROUND_CAROUSEL_MIN_ITEMS = 3;

export type RoundCarouselLook = {
  spacing: number;
  tilt: number;
  perspective: number;
};

/**
 * Official Originkit defaults, except even counts: equal 360° spacing puts one
 * face at 180° behind the front, so a 6-card ring still reads as 5. Extra tilt
 * makes that back face peek without changing the ring math.
 */
export function roundCarouselLook(count: number): RoundCarouselLook {
  if (count >= 2 && count % 2 === 0) {
    return { spacing: 2, tilt: -9, perspective: 1800 };
  }
  return { spacing: 2, tilt: -7, perspective: 3000 };
}

/**
 * Vertical room so Originkit's `overflow: hidden` does not clip tilted faces.
 * After `rotateX(tilt)`, a face at z = ±radius reaches
 * `(height/2) * cos(tilt) + radius * sin(|tilt|)` from the ring center, then
 * CSS perspective scales the front face toward the camera.
 */
export function roundCarouselStageHeight(
  imageWidth: number,
  count: number,
  look: RoundCarouselLook,
  shadowPad: number
): number {
  const pad = Math.max(0, shadowPad);
  if (count < 2 || imageWidth <= 0) return Math.ceil(Math.max(0, imageWidth) + pad * 2);
  const radius = roundCarouselRadius(imageWidth, count, look.spacing);
  const tiltRad = (Math.abs(look.tilt) * Math.PI) / 180;
  const halfUnprojected = (imageWidth / 2) * Math.cos(tiltRad) + radius * Math.sin(tiltRad);
  const zTowardCamera = radius * Math.cos(tiltRad);
  const perspective = Math.max(1, look.perspective);
  const denom = perspective - zTowardCamera;
  const scale = denom > 1 ? Math.min(perspective / denom, 2) : 2;
  return Math.ceil(2 * (halfUnprojected + pad) * scale);
}
