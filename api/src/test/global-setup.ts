import { db } from '../db';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Global test setup - runs once before all tests
 */
export async function setup() {
  console.log('🚀 Starting global test setup...');
  const startTime = Date.now();

  try {
    // 1. Verify test database exists and is accessible
    await verifyTestDatabase();
    
    // 2. Run database migrations if needed
    await ensureDatabaseSchema();
    
    // 3. Verify all required tables exist
    await verifyDatabaseTables();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Global test teardown - runs once after all tests
 */
export async function teardown() {
  console.log('🧹 Starting global test teardown...');
  const startTime = Date.now();

  try {
    // Close database connections
    await db.end();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here - we don't want to fail the test run
  }
}

/**
 * Verify test database is accessible
 */
async function verifyTestDatabase() {
  try {
    const result = await db.query('SELECT current_database(), version()');
    const dbName = result.rows[0].current_database;
    
    if (!dbName.includes('test')) {
      console.warn('⚠️ Warning: Database name does not contain "test":', dbName);
    } else {
      console.log('✅ Connected to test database:', dbName);
    }
    
  } catch (error) {
    throw new Error(`Failed to connect to test database: ${error}`);
  }
}

/**
 * Ensure database schema is up to date
 */
async function ensureDatabaseSchema() {
  try {
    // Check if tables exist, if not apply schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('studios', 'customers', 'slots', 'invites', 'children', 'bookings')
    `;
    
    const result = await db.query(tablesQuery);
    const existingTables = result.rows.map(row => row.table_name);
    const requiredTables = ['studios', 'customers', 'slots', 'invites', 'children', 'bookings'];
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('📦 Missing tables detected, applying schema...');
      await applyDatabaseSchema();
    } else {
      console.log('✅ Database schema is up to date');
    }
    
  } catch (error) {
    throw new Error(`Failed to verify database schema: ${error}`);
  }
}

/**
 * Apply database schema from migration file
 */
async function applyDatabaseSchema() {
  try {
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20250101000000_initial_schema.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    await db.query(migrationSQL);
    console.log('✅ Database schema applied successfully');
    
  } catch (error) {
    throw new Error(`Failed to apply database schema: ${error}`);
  }
}

/**
 * Verify all required tables exist
 */
async function verifyDatabaseTables() {
  const requiredTables = ['studios', 'customers', 'slots', 'invites', 'children', 'bookings'];
  
  for (const table of requiredTables) {
    try {
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch (error) {
      throw new Error(`Table ${table} does not exist or is not accessible`);
    }
  }
  
  console.log(`✅ All ${requiredTables.length} required tables verified`);
}

