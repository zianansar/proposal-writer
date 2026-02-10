/**
 * Tests for database utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTestDatabasePath,
  clearDatabase,
  databaseExists,
} from './dbUtils';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { dirname } from 'path';

describe('dbUtils', () => {
  const testDbPath = getTestDatabasePath();

  beforeEach(() => {
    // Ensure clean state
    clearDatabase();
  });

  afterEach(() => {
    // Cleanup after tests
    clearDatabase();
  });

  describe('getTestDatabasePath', () => {
    it('should return absolute path to test database', () => {
      const path = getTestDatabasePath();
      expect(path).toContain('test-data');
      expect(path).toContain('test.db');
    });

    it('should ensure test-data directory exists', () => {
      const path = getTestDatabasePath();
      const dir = dirname(path);
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('clearDatabase', () => {
    it('should remove database file if it exists', () => {
      // Create a dummy database file
      writeFileSync(testDbPath, 'dummy data');
      expect(existsSync(testDbPath)).toBe(true);

      // Clear it
      clearDatabase();
      expect(existsSync(testDbPath)).toBe(false);
    });

    it('should not throw if database does not exist', () => {
      expect(() => {
        clearDatabase();
      }).not.toThrow();
    });
  });

  describe('databaseExists', () => {
    it('should return false when database does not exist', () => {
      clearDatabase();
      expect(databaseExists()).toBe(false);
    });

    it('should return true when database exists', () => {
      writeFileSync(testDbPath, 'dummy data');
      expect(databaseExists()).toBe(true);
    });
  });
});
