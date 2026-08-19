import * as Haptics from 'expo-haptics';

/** Light impact for taps — kept outside AppSessionContext to avoid Metro require cycles. */
export function stepHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
