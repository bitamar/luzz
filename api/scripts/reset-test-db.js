#!/usr/bin/env node

/**
 * Test Database Reset Script
 *
 * Completely resets the test database by dropping and recreating it
 */

const { execSync } = require('child_process');

// Configuration
const config = {
  testDb:
    process.env.DATABASE_URL_TEST ||
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres_test',
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
 * Drop test database
 */
function dropTestDatabase() {
  console.log('🗑️  Dropping test database...');

  const testDbName = config.testDb.split('/').pop();
  const baseUrl = config.testDb.replace(`/${testDbName}`, '/postgres');

  try {
    execCommand(`psql "${baseUrl}" -c "DROP DATABASE IF EXISTS ${testDbName}"`);
    console.log('✅ Test database dropped successfully');
  } catch (error) {
    console.warn('⚠️ Failed to drop test database (it may not exist)');
  }
}

/**
 * Main reset function
 */
function main() {
  console.log('🔄 Resetting test database...');

  try {
    // Drop test database
    dropTestDatabase();

    // Recreate by running setup script
    console.log('🏗️  Recreating test database...');
    execCommand('node scripts/setup-test-db.js');

    console.log('🎉 Test database reset completed successfully!');
  } catch (error) {
    console.error('💥 Test database reset failed:', error.message);
    process.exit(1);
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Test Database Reset Script

Usage: node reset-test-db.js [options]

Options:
  --help, -h     Show this help message
  
This script will:
1. Drop the existing test database
2. Create a new test database
3. Apply the schema migrations
4. Verify the setup

Environment Variables:
  DATABASE_URL_TEST Test database URL (default: postgresql://postgres:postgres@127.0.0.1:54322/postgres_test)

Examples:
  node reset-test-db.js
  DATABASE_URL_TEST=postgresql://localhost/test_db node reset-test-db.js
  `);
  process.exit(0);
}

// Run the reset
main();
