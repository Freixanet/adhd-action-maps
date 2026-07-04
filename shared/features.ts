/** Feature gates — flip when billing / Pro plan is wired. */
export const FEATURES = {
  /** Custom category names beyond defaults. Set false to gate behind Pro. */
  customCategories: false,
  /** "Profundo" depth tier. Set true once the user has the Pro entitlement. */
  deepDepth: false,
} as const;
