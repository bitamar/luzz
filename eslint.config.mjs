/** Minimal flat config for repo */
export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', '**/dist/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {},
  },
];





