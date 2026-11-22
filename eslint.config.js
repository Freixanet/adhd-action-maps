import tseslint from "typescript-eslint";

export default [
  {
    files: ["*.ts", "src/**/*.{ts,tsx}", "shared/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-cond-assign": "error",
      "no-debugger": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-unsafe-finally": "error",
      "no-unreachable": "error",
      "use-isnan": "error",
    },
  },
  {
    files: ["server.ts", "serverSchemas.ts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];
