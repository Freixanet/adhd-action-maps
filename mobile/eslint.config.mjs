import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Hooks-only lint pass, run via `npm run lint:hooks`. `npm run lint` stays
 * `tsc --noEmit` so this does not widen the type-check baseline.
 *
 * It exists because a missing dependency in a `useCallback` shipped a composer
 * bug TypeScript cannot see: the handler captured a stale `uploadedFile` and
 * silently dropped file-only sends.
 *
 * `exhaustive-deps` is a warning, not an error, because the existing code has a
 * backlog of findings. Adding a dep can re-run an effect, so each one needs its
 * own review rather than a blanket fix.
 */
export default tseslint.config({
  files: ['src/**/*.{ts,tsx}', 'App.tsx'],
  linterOptions: {
    // Directives here target rules from other lint setups, not this pass.
    reportUnusedDisableDirectives: 'off',
  },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    'react-hooks': reactHooks,
    // Registered so inline disables naming its rules resolve.
    '@typescript-eslint': tseslint.plugin,
  },
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
  },
});
