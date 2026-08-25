import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Named haptic intents. Call these — never a generic tap tick.
 * Web is a no-op (Safari iOS has no reliable haptic). Visual feedback must
 * stand alone: Low Power Mode, system settings, camera and dictation mute iOS.
 */
function nativeOs(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

function ignore() {}

export function hapticSegment(): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.selectionAsync().catch(ignore);
  }
}

export function hapticToggle(on: boolean): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(
      on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off
    ).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  }
}

/** Sidebar latch — fire only when open/closed actually flips, never per-drag. */
export function hapticDrawer(open: boolean): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(
      open ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off
    ).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(ignore);
  }
}

export function hapticCommit(): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
  }
}

export function hapticSuccess(): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  }
}

export function hapticError(): void {
  const os = nativeOs();
  if (os === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject).catch(ignore);
    return;
  }
  if (os === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
  }
}

/** Expected friction (quiz miss, quota). Not a system failure — iOS Warning only. */
export function hapticWarning(): void {
  if (nativeOs() !== 'ios') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
}
