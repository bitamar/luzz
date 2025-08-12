import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { name: 'dock', test: { environment: 'jsdom', include: ['apps/dock/**/*.test.{ts,tsx}'] } },
      { name: 'sail', test: { environment: 'jsdom', include: ['apps/sail/**/*.test.{ts,tsx}'] } },
      { name: 'hq', test: { environment: 'jsdom', include: ['apps/hq/**/*.test.{ts,tsx}'] } },
      {
        name: 'packages',
        test: { environment: 'node', include: ['packages/**/__tests__/**/*.test.ts'] },
      },
    ],
  },
});
