#!/usr/bin/env node

/**
 * Test Database Setup Script
 *
 * Automates the creation and setup of test database for CI/CD and local development
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  testDb: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres_test',
  migrationPath: path.join(__dirname, '../../supabase/migrations/20250101000000_initial_schema.sql'),
  extraMigrations: [path.join(__dirname, '../../supabase/migrations/20250102000000_auth_schema.sql')],
  isCI: process.env.CI === 'true',
};

/**
 * Execute a command and handle errors
 */
function execCommand(command, options = {}) {
  try {
    console.log(`🔄 Executing: ${command}`);
    return execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options,
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Check if database exists
 */
function checkDatabaseExists(dbUrl) {
  try {
    execCommand(`psql "${dbUrl}" -c "SELECT 1" > /dev/null 2>&1`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create test database
 */
function createTestDatabase() {
  console.log('🏗️  Creating test database...');

  // Extract database name from URL
  const testDbName = config.testDb.split('/').pop();
  const baseUrl = config.testDb.replace(`/${testDbName}`, '/postgres');

  try {
    execCommand(`psql "${baseUrl}" -c "CREATE DATABASE ${testDbName}"`);
    console.log('✅ Test database created successfully');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Test database already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Apply database schema
 */
function applySchema() {
  console.log('📦 Applying database schema...');

  if (!fs.existsSync(config.migrationPath)) {
    throw new Error(`Migration file not found: ${config.migrationPath}`);
  }

  execCommand(`psql "${config.testDb}" < "${config.migrationPath}"`);
  for (const extra of config.extraMigrations) {
    if (fs.existsSync(extra)) {
      execCommand(`psql "${config.testDb}" < "${extra}"`);
    }
  }
  console.log('✅ Database schema applied successfully');
}

/**
 * Verify database setup
 */
function verifySetup() {
  console.log('🔍 Verifying database setup...');

  const tables = ['studios', 'customers', 'slots', 'invites', 'children', 'bookings'];

  for (const table of tables) {
    try {
      execCommand(`psql "${config.testDb}" -c "SELECT 1 FROM ${table} LIMIT 1" > /dev/null`, { stdio: 'ignore' });
    } catch {
      throw new Error(`Table ${table} does not exist or is not accessible`);
    }
  }

  console.log(`✅ All ${tables.length} tables verified`);
}

/**
 * Clean up test database (for CI environments)
 */
function cleanupTestData() {
  if (!config.isCI) {
    return; // Only cleanup in CI
  }

  console.log('🧹 Cleaning up test data...');
  execCommand(
    `psql "${config.testDb}" -c "TRUNCATE TABLE bookings, children, invites, customers, slots, studios CASCADE"`
  );
  console.log('✅ Test data cleaned up');
}

/**
 * Main setup function
 */
function main() {
  console.log('🚀 Starting test database setup...');
  console.log(`📍 Target database: ${config.testDb.replace(/\/\/[^@]+@/, '//***:***@')}`);

  try {
    // Check if test database exists, create if needed
    if (!checkDatabaseExists(config.testDb)) {
      createTestDatabase();
    } else {
      console.log('ℹ️  Test database already exists');
    }

    // Apply schema
    applySchema();

    // Verify setup
    verifySetup();

    // Clean up data in CI
    cleanupTestData();

    console.log('🎉 Test database setup completed successfully!');
  } catch (error) {
    console.error('💥 Test database setup failed:', error.message);
    process.exit(1);
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Test Database Setup Script

Usage: node setup-test-db.js [options]

Options:
  --help, -h     Show this help message
  
Environment Variables:
  DATABASE_URL      Database URL (default: postgresql://postgres:postgres@127.0.0.1:54322/postgres_test)
  CI               Set to 'true' for CI environment behavior

Examples:
  node setup-test-db.js
  DATABASE_URL=postgresql://localhost/my_test_db node setup-test-db.js
  `);
  process.exit(0);
}

// Run the setup
main();
