/** Pure scheduling helper — no Expo imports (unit-testable). */

/** Next 18:00 local; if already past 21:00, schedule tomorrow 18:00. */
export function nextIncompleteReminderDate(now = new Date()): Date {
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (now.getHours() >= 21 || now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
    target.setHours(18, 0, 0, 0);
  }
  return target;
}
