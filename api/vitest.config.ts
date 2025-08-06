import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Environment configuration
    environment: 'node',
    
    // Global setup and teardown
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup-each.ts'],
    
    // Test execution configuration
    sequence: {
      hooks: 'stack', // Ensure proper cleanup order
    },
    
    // Performance optimization for database tests
    poolOptions: {
      threads: {
        singleThread: true, // Avoid database conflicts in parallel tests
        isolate: true, // Isolate test contexts
      },
    },
    
    // Timeouts
    testTimeout: 10000, // 10 seconds for database operations
    hookTimeout: 30000, // 30 seconds for setup/teardown
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Reporter configuration
    reporters: process.env.CI ? ['junit', 'verbose'] : 'verbose',
    outputFile: process.env.CI ? './test-results.xml' : undefined,
    
    // Test pattern matching
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
    },
    
    // Performance tracking
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.ts'],
      exclude: ['node_modules/**'],
    }
  },
  
  // Path resolution for imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './src/test'),
    },
  },
});