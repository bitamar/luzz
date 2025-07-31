import { expect } from 'vitest';
import { getDbClient } from './test-helpers';

/**
 * Advanced Test Utilities
 * 
 * Provides specialized testing utilities, custom assertions,
 * and database verification helpers.
 */

/**
 * Custom Assertions for API Testing
 */
export const assertions = {
  /**
   * Assert that a response has valid UUID format
   */
  toHaveValidUuid(response: any, field: string = 'id') {
    const uuid = response.body[field];
    expect(uuid).toBeDefined();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    return uuid;
  },

  /**
   * Assert that a response has valid timestamp format
   */
  toHaveValidTimestamp(response: any, field: string) {
    const timestamp = response.body[field];
    expect(timestamp).toBeDefined();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
    return new Date(timestamp);
  },

  /**
   * Assert that a price field is properly formatted
   */
  toHaveValidPrice(response: any, field: string = 'price') {
    const price = response.body[field];
    expect(price).toBeDefined();
    expect(typeof price).toBe('string');
    expect(parseFloat(price)).toBeGreaterThanOrEqual(0);
    expect(price).toMatch(/^\d+\.\d{2}$/); // Format: XX.XX
    return parseFloat(price);
  },

  /**
   * Assert that response contains required fields
   */
  toHaveRequiredFields(response: any, fields: string[]) {
    for (const field of fields) {
      expect(response.body[field]).toBeDefined();
    }
    return response.body;
  },

  /**
   * Assert that database record exists
   */
  async toExistInDatabase(table: string, id: string) {
    const client = getDbClient();
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    expect(result.rows.length).toBe(1);
  },

  /**
   * Assert that database record does not exist
   */
  async toNotExistInDatabase(table: string, id: string) {
    const client = getDbClient();
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    expect(result.rows.length).toBe(0);
  },
};

/**
 * Database Verification Helpers
 */
export const dbHelpers = {
  /**
   * Get record count for a table
   */
  async getRecordCount(table: string): Promise<number> {
    const client = getDbClient();
    const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
    return parseInt(result.rows[0].count);
  },

  /**
   * Get a record by ID
   */
  async getRecord(table: string, id: string): Promise<any> {
    const client = getDbClient();
    const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] || null;
  },

  /**
   * Check if a record exists
   */
  async recordExists(table: string, id: string): Promise<boolean> {
    const client = getDbClient();
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    return result.rows.length > 0;
  },

  /**
   * Get records with conditions
   */
  async getRecords(table: string, where: Record<string, any> = {}): Promise<any[]> {
    const client = getDbClient();
    
    if (Object.keys(where).length === 0) {
      const result = await client.query(`SELECT * FROM ${table}`);
      return result.rows;
    }

    const conditions = Object.keys(where).map((key, idx) => `${key} = $${idx + 1}`);
    const values = Object.values(where);
    
    const query = `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}`;
    const result = await client.query(query, values);
    return result.rows;
  },

  /**
   * Verify foreign key relationships
   */
  async verifyRelationship(childTable: string, parentTable: string, childId: string, parentField: string = 'studio_id'): Promise<boolean> {
    const client = getDbClient();
    const query = `
      SELECT 1 FROM ${childTable} c
      JOIN ${parentTable} p ON c.${parentField} = p.id
      WHERE c.id = $1
    `;
    const result = await client.query(query, [childId]);
    return result.rows.length > 0;
  },
};

/**
 * Performance Testing Utilities
 */
export const performance = {
  /**
   * Measure execution time of an async function
   */
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  },

  /**
   * Run a function multiple times and get statistics
   */
  async benchmark<T>(fn: () => Promise<T>, iterations: number = 10): Promise<{
    results: T[];
    times: number[];
    avg: number;
    min: number;
    max: number;
    median: number;
  }> {
    const results: T[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureTime(fn);
      results.push(measurement.result);
      times.push(measurement.duration);
    }

    times.sort((a, b) => a - b);
    
    return {
      results,
      times,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: times[0],
      max: times[times.length - 1],
      median: times[Math.floor(times.length / 2)],
    };
  },

  /**
   * Assert that operation completes within time limit
   */
  async expectTimingUnder<T>(fn: () => Promise<T>, maxMs: number): Promise<T> {
    const measurement = await this.measureTime(fn);
    expect(measurement.duration).toBeLessThan(maxMs);
    return measurement.result;
  },
};

/**
 * Data Validation Helpers
 */
export const validation = {
  /**
   * Validate UUID format
   */
  isValidUuid(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  },

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Validate phone format
   */
  isValidPhone(phone: string): boolean {
    return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
  },

  /**
   * Validate ISO date format
   */
  isValidIsoDate(date: string): boolean {
    try {
      return new Date(date).toISOString() === date;
    } catch {
      return false;
    }
  },

  /**
   * Validate currency code
   */
  isValidCurrency(currency: string): boolean {
    return /^[A-Z]{3}$/.test(currency);
  },

  /**
   * Validate slug format
   */
  isValidSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 50;
  },
};

/**
 * HTTP Testing Helpers
 */
export const http = {
  /**
   * Common headers for API requests
   */
  headers: {
    json: { 'Content-Type': 'application/json' },
    auth: (token: string) => ({ Authorization: `Bearer ${token}` }),
  },

  /**
   * Extract error details from response
   */
  extractError(response: any): { message: string; details?: any } {
    return {
      message: response.body.error || response.body.message || 'Unknown error',
      details: response.body.details || response.body.data,
    };
  },

  /**
   * Create URL with query parameters
   */
  withQuery(url: string, params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    return `${url}?${searchParams.toString()}`;
  },
};

/**
 * Test Environment Helpers
 */
export const env = {
  /**
   * Check if running in CI environment
   */
  isCI(): boolean {
    return process.env.CI === 'true' || process.env.NODE_ENV === 'ci';
  },

  /**
   * Get test database URL
   */
  getTestDatabaseUrl(): string {
    return process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres_test';
  },

  /**
   * Check if we're in test environment
   */
  isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  },

  /**
   * Get test timeout from environment
   */
  getTestTimeout(): number {
    return parseInt(process.env.TEST_TIMEOUT || '10000');
  },
};