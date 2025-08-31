import { Pool, PoolClient } from 'pg';
import 'dotenv/config';

// Load test environment if in test mode
if (process.env.NODE_ENV === 'test') {
  import('dotenv').then(dotenv => dotenv.config({ path: '.env.test' }));
}

// Use test database when NODE_ENV=test
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === 'test') {
    // For tests, use postgres_test database
    return (
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres_test'
    );
  }
  return process.env.DATABASE_URL;
};

export const db = new Pool({
  connectionString: getDatabaseUrl(),
  // Connection pool settings optimized for environment
  max: process.env.NODE_ENV === 'test' ? 5 : 20, // Fewer connections for tests
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Track if pool is already ended to prevent double-close
let isPoolEnded = false;

// Safe cleanup function
export async function closeDatabase() {
  if (!isPoolEnded) {
    console.warn('Closing database pool...');
    await db.end();
    isPoolEnded = true;
  }
}

// Global test transaction client (only available in test environment)
let testTransactionClient: PoolClient | null = null;

// Set the test transaction client (called from test setup)
export function setTestTransactionClient(client: PoolClient) {
  testTransactionClient = client;
}

// Clear the test transaction client (called from test cleanup)
export function clearTestTransactionClient() {
  testTransactionClient = null;
}

// Get the appropriate database client (transaction in tests, regular pool otherwise)
export function getDbClient() {
  // In test environment, use transaction client if available
  if (process.env.NODE_ENV === 'test' && testTransactionClient) {
    return testTransactionClient;
  }
  return db;
}

// Graceful shutdown (only for non-test environments)
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', async () => {
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeDatabase();
    process.exit(0);
  });
}
