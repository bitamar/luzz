import { beforeEach, afterEach } from 'vitest';
import { testTransaction } from './transaction-manager';
import { setTestTransactionClient, clearTestTransactionClient } from '../db';

/**
 * Setup that runs before each individual test
 */
beforeEach(async () => {
  // Start a transaction for each test for perfect isolation
  const client = await testTransaction.beginTransaction();
  // Set the transaction client so routes can use it
  setTestTransactionClient(client);
});

/**
 * Cleanup that runs after each individual test
 */
afterEach(async () => {
  // Clear the transaction client
  clearTestTransactionClient();
  // Rollback the transaction to clean up all changes
  await testTransaction.rollback();
});
