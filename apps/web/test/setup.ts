/**
 * Global test setup for comprehensive test suite
 * Initializes database connections, configures test environment,
 * and sets up common fixtures
 */

import { pgPool } from "../lib/db";

// Ensure database is available before running tests
export async function setupDatabase(): Promise<void> {
  const pool = pgPool();
  try {
    await pool.query("SELECT NOW()");
    console.log("✓ Database connection verified");
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error;
  }
}

// Configure test timeouts
export const TEST_TIMEOUT_MS = 30000;
export const DB_TIMEOUT_MS = 10000;

// Test data prefixes (for isolation)
export const TEST_PREFIXES = {
  user: "test_user_",
  workspace: "test_ws_",
  session: "test_session_",
  enrollment: "test_enrollment_",
  project: "test_project_",
};

// Mock configuration for tests
export const MOCK_CONFIG = {
  AUTH_SECRET: process.env.AUTH_SECRET || "test-secret-key-do-not-use-in-production",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost/test",
  NODE_ENV: "test",
};

// Performance thresholds for load tests
export const PERF_THRESHOLDS = {
  queryMs: 100,
  batchQueryMs: 500,
  passwordHashMs: 200,
  concurrentOpsMs: 5000,
};

/**
 * Clean up test data after all tests complete
 * Called by test teardown hooks
 */
export async function cleanupTestData(): Promise<void> {
  const pool = pgPool();
  try {
    // Delete test workspaces (cascades to enrollments, etc)
    await pool.query("DELETE FROM workspaces WHERE name LIKE $1", ["test_%"]);
    // Delete test users
    await pool.query("DELETE FROM users WHERE email LIKE $1", ["test_%@%"]);
    console.log("✓ Test data cleaned up");
  } catch (error) {
    console.error("✗ Cleanup failed:", error);
  }
}

/**
 * Generate unique test identifier
 * Use for creating collision-safe test data
 */
export function generateTestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Export helpers for test files
export const testHelpers = {
  generateTestId,
  setupDatabase,
  cleanupTestData,
};
