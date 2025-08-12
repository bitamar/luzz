/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  plugins: ['prettier-plugin-svelte'],
  overrides: [
    {
      files: ['**/*.svelte'],
      options: { parser: 'svelte' },
    },
  ],
};
