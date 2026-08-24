/** Apple-style exponential rubber band. Used from UI-thread worklets. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function rubberbandOffset(next: number, min: number, max: number, dimension: number) {
  'worklet';
  if (next < min) return min + rubberband(next - min, dimension);
  if (next > max) return max + rubberband(next - max, dimension);
  return next;
}
