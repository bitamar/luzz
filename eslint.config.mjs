import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** Unified flat config for repo */
export default [
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', '**/dist/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {},
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', '**/dist/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: ['./api/tsconfig.json', './packages/*/tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
