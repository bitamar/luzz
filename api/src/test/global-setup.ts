import { db } from '../db';
// import { exec } from 'child_process';
// import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

// const execAsync = promisify(exec); // Future use for database operations

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
      console.warn(
        '⚠️ Warning: Database name does not contain "test":',
        dbName
      );
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
    const initialTables = [
      'studios',
      'customers',
      'slots',
      'invites',
      'children',
      'bookings',
    ];
    const authTables = ['users', 'studio_owners'];

    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const result = await db.query(tablesQuery);
    const existingTables = new Set(result.rows.map(row => row.table_name));

    const missingInitial = initialTables.filter(t => !existingTables.has(t));
    const missingAuth = authTables.filter(t => !existingTables.has(t));

    if (missingInitial.length || missingAuth.length) {
      console.log('📦 Missing tables detected, applying schema...');
      await applyDatabaseSchema({
        applyInitial: !!missingInitial.length,
        applyAuth: !!missingAuth.length,
      });
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
async function applyDatabaseSchema(opts: {
  applyInitial: boolean;
  applyAuth: boolean;
}) {
  try {
    const initialPath = await resolveRepoPath(
      'supabase/migrations/20250101000000_initial_schema.sql'
    );
    const authPath = await resolveRepoPath(
      'supabase/migrations/20250102000000_auth_schema.sql'
    );
    if (opts.applyInitial) {
      const initialSQL = await fs.readFile(initialPath, 'utf-8');
      await db.query(initialSQL);
    }
    if (opts.applyAuth && (await fileExists(authPath))) {
      const authSQL = await fs.readFile(authPath, 'utf-8');
      await db.query(authSQL);
    }
    console.log('✅ Database schema applied successfully');
  } catch (error) {
    throw new Error(`Failed to apply database schema: ${error}`);
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoPath(relativeFromRoot: string): Promise<string> {
  const try1 = path.resolve(process.cwd(), '..', relativeFromRoot);
  if (await fileExists(try1)) return try1;
  const try2 = path.resolve(__dirname, '../../../', relativeFromRoot);
  if (await fileExists(try2)) return try2;
  return path.resolve(relativeFromRoot);
}

/**
 * Verify all required tables exist
 */
async function verifyDatabaseTables() {
  const requiredTables = [
    'studios',
    'customers',
    'slots',
    'invites',
    'children',
    'bookings',
  ];

  for (const table of requiredTables) {
    try {
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch {
      throw new Error(`Table ${table} does not exist or is not accessible`);
    }
  }

  console.log(`✅ All ${requiredTables.length} required tables verified`);
}
