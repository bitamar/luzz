import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { environment: 'jsdom', include: ['apps/dock/**/*.test.{ts,tsx}'] } },
      { test: { environment: 'jsdom', include: ['apps/sail/**/*.test.{ts,tsx}'] } },
      { test: { environment: 'jsdom', include: ['apps/hq/**/*.test.{ts,tsx}'] } },
      { test: { environment: 'node', include: ['packages/**/__tests__/**/*.test.ts'] } }
    ]
  }
});

