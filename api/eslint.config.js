import typescript from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier: prettier
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['src/test/**/*.ts'],
    rules: {
      'no-console': 'off', // Allow console statements in test files
      '@typescript-eslint/no-explicit-any': 'off' // Allow any in test utilities
    }
  },
  {
    files: ['src/middleware/**/*.ts', 'src/server.ts'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }] // Allow console.log in middleware and server
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js']
  }
];
