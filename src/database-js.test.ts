import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Database } from './database';

describe('Database JavaScript Module Support', () => {
  const testJsPath = resolve(__dirname, '../test-db.js');
  const testMjsPath = resolve(__dirname, '../test-db.mjs');

  afterAll(() => {
    // Clean up test files
    if (existsSync(testJsPath)) unlinkSync(testJsPath);
    if (existsSync(testMjsPath)) unlinkSync(testMjsPath);
  });

  describe('Static JavaScript Export', () => {
    beforeAll(() => {
      // Create a JavaScript file that exports static data
      const jsContent = `
export default {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ],
  posts: [
    { id: 1, userId: 1, title: 'Hello' }
  ]
};
`;
      writeFileSync(testJsPath, jsContent);
    });

    it('should load JavaScript file with static export', async () => {
      const db = new Database(testJsPath);
      await db.init();

      const users = db.getCollection('users') as { id: number; name: string }[];
      expect(users).toHaveLength(2);
      expect(users[0]).toMatchObject({ id: 1, name: 'Alice' });
    });

    it('should support all collections from JS file', async () => {
      const db = new Database(testJsPath);
      await db.init();

      expect(db.getCollection('users')).toHaveLength(2);
      expect(db.getCollection('posts')).toHaveLength(1);
    });
  });

  describe('Dynamic JavaScript Export (Function)', () => {
    beforeAll(() => {
      // Create a JavaScript file that exports a function
      const jsContent = `
export default function() {
  return {
    users: [
      { id: 1, name: 'User 1', timestamp: Date.now() },
      { id: 2, name: 'User 2', timestamp: Date.now() }
    ],
    generated: [
      { id: 1, value: Math.random() }
    ]
  };
}
`;
      writeFileSync(testMjsPath, jsContent);
    });

    it('should call function to generate data', async () => {
      const db = new Database(testMjsPath);
      await db.init();

      const users = db.getCollection('users') as { id: number; name: string }[];
      expect(users).toHaveLength(2);
      expect(users[0]).toHaveProperty('timestamp');
      expect(users[0]).toHaveProperty('name', 'User 1');
    });

    it('should generate different data on each init', async () => {
      const db = new Database(testMjsPath);
      
      await db.init();
      const firstGenerated = (db.getCollection('generated') as { id: number; value: number }[])[0] as { id: number; value: number };
      const firstValue = firstGenerated.value;

      await db.init();
      const secondGenerated = (db.getCollection('generated') as { id: number; value: number }[])[0] as { id: number; value: number };
      const secondValue = secondGenerated.value;

      // Values should be different since Math.random() is called each time
      expect(firstValue).not.toBe(secondValue);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent JS file', async () => {
      const db = new Database('nonexistent.js');
      
      await expect(db.init()).rejects.toThrow('Database file not found');
    });

    it('should throw error for invalid JS module', async () => {
      const invalidPath = resolve(__dirname, '../test-invalid.js');
      writeFileSync(invalidPath, 'export default "invalid";');

      const db = new Database(invalidPath);
      
      try {
        await expect(db.init()).rejects.toThrow('JavaScript module must export an object or function');
      } finally {
        if (existsSync(invalidPath)) unlinkSync(invalidPath);
      }
    });

    it('should throw error when function returns non-object', async () => {
      const invalidPath = resolve(__dirname, '../test-invalid-fn.js');
      writeFileSync(invalidPath, 'export default function() { return "invalid"; }');

      const db = new Database(invalidPath);
      
      try {
        await expect(db.init()).rejects.toThrow('JavaScript module function must return an object');
      } finally {
        if (existsSync(invalidPath)) unlinkSync(invalidPath);
      }
    });
  });
});
