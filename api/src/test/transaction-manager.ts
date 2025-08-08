import { PoolClient, QueryResult } from 'pg';
import { db } from '../db';

/**
 * Transaction Manager for Test Isolation
 *
 * Provides transaction-based test isolation where each test runs in its own transaction
 * that gets rolled back at the end, ensuring perfect isolation and fast cleanup.
 */
export class TransactionManager {
  private client: PoolClient | null = null;
  private inTransaction = false;

  /**
   * Start a new transaction for a test
   */
  async beginTransaction(): Promise<PoolClient> {
    if (this.client) {
      throw new Error('Transaction already active. Call rollback() first.');
    }

    this.client = await db.connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;

    return this.client;
  }

  /**
   * Rollback the current transaction and clean up
   */
  async rollback(): Promise<void> {
    if (!this.client || !this.inTransaction) {
      return;
    }

    try {
      await this.client.query('ROLLBACK');
    } catch (error) {
      console.warn('Error during transaction rollback:', error);
    } finally {
      this.client.release();
      this.client = null;
      this.inTransaction = false;
    }
  }

  /**
   * Get the current transaction client
   */
  getClient(): PoolClient {
    if (!this.client || !this.inTransaction) {
      throw new Error('No active transaction. Call beginTransaction() first.');
    }
    return this.client;
  }

  /**
   * Check if we're currently in a transaction
   */
  isInTransaction(): boolean {
    return this.inTransaction;
  }

  /**
   * Execute a query within the current transaction
   */
  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const client = this.getClient();
    return client.query(text, params);
  }
}

// Global transaction manager instance for tests
export const testTransaction = new TransactionManager();
