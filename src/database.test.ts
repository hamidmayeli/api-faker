import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/database';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';

describe('Database', () => {
  const testDbPath = resolve(__dirname, 'test-db.json');

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Initialization', () => {
    it('should initialize with a JSON file', async () => {
      const testData = {
        posts: [{ id: 1, title: 'Hello' }],
        users: [{ id: 1, name: 'John' }],
      };
      writeFileSync(testDbPath, JSON.stringify(testData));

      const db = new Database(testDbPath);
      await db.init();

      expect(db.getData()).toEqual(testData);
    });

    it('should initialize with object data', async () => {
      const testData = {
        posts: [{ id: 1, title: 'Hello' }],
      };

      const db = new Database(testData);
      await db.init();

      expect(db.getData()).toEqual(testData);
    });

    it('should throw error if file does not exist', async () => {
      const db = new Database('nonexistent.json');
      await expect(db.init()).rejects.toThrow('Database file not found');
    });

    it('should handle empty database', async () => {
      writeFileSync(testDbPath, JSON.stringify({}));
      
      const db = new Database(testDbPath);
      await db.init();

      expect(db.getData()).toEqual({});
    });
  });

  describe('ID Generation', () => {
    it('should generate ID 1 for empty collection', async () => {
      const db = new Database({ posts: [] });
      await db.init();

      const id = db.generateId('posts');
      expect(id).toBe(1);
    });

    it('should generate next ID based on max ID', async () => {
      const db = new Database({
        posts: [
          { id: 1, title: 'First' },
          { id: 5, title: 'Fifth' },
          { id: 3, title: 'Third' },
        ],
      });
      await db.init();

      const id = db.generateId('posts');
      expect(id).toBe(6);
    });

    it('should handle non-existent collection', async () => {
      const db = new Database({});
      await db.init();

      const id = db.generateId('posts');
      expect(id).toBe(1);
    });
  });

  describe('CRUD Operations - Collections', () => {
    let db: Database;

    beforeEach(async () => {
      const testData = {
        posts: [
          { id: 1, title: 'Post 1', author: 'Alice' },
          { id: 2, title: 'Post 2', author: 'Bob' },
        ],
      };
      writeFileSync(testDbPath, JSON.stringify(testData));
      db = new Database(testDbPath);
      await db.init();
    });

    describe('Create', () => {
      it('should create new item with auto-generated ID', async () => {
        const newItem = await db.create('posts', { title: 'New Post', author: 'Charlie' });

        expect(newItem).toEqual({
          id: 3,
          title: 'New Post',
          author: 'Charlie',
        });
      });

      it('should create item with provided ID', async () => {
        const newItem = await db.create('posts', { id: 10, title: 'Custom ID' });

        expect(newItem).toEqual({
          id: 10,
          title: 'Custom ID',
        });
      });

      it('should throw error if ID already exists', async () => {
        await expect(
          db.create('posts', { id: 1, title: 'Duplicate' })
        ).rejects.toThrow('already exists');
      });

      it('should create collection if it does not exist', async () => {
        const newItem = await db.create('comments', { text: 'First comment' });

        expect(newItem.id).toBe(1);
        expect(db.isCollection('comments')).toBe(true);
      });
    });

    describe('Read', () => {
      it('should get collection', () => {
        const posts = db.getCollection('posts');
        expect(Array.isArray(posts)).toBe(true);
        expect((posts as unknown[]).length).toBe(2);
      });

      it('should get item by ID', () => {
        const post = db.getById('posts', 1);
        expect(post).toEqual({ id: 1, title: 'Post 1', author: 'Alice' });
      });

      it('should get item by string ID', () => {
        const post = db.getById('posts', '2');
        expect(post).toEqual({ id: 2, title: 'Post 2', author: 'Bob' });
      });

      it('should return undefined for non-existent ID', () => {
        const post = db.getById('posts', 999);
        expect(post).toBeUndefined();
      });

      it('should return undefined for non-existent collection', () => {
        const data = db.getCollection('nonexistent');
        expect(data).toBeUndefined();
      });
    });

    describe('Update (PUT)', () => {
      it('should update item completely', async () => {
        const updated = await db.update('posts', 1, { title: 'Updated Title' });

        expect(updated).toEqual({ id: 1, title: 'Updated Title' });
        // Original author field should be gone
        expect(updated).not.toHaveProperty('author');
      });

      it('should preserve ID even if provided in data', async () => {
        const updated = await db.update('posts', 1, { id: 999, title: 'Updated' });

        expect(updated).toEqual({ id: 1, title: 'Updated' });
      });

      it('should return undefined for non-existent item', async () => {
        const result = await db.update('posts', 999, { title: 'Updated' });
        expect(result).toBeUndefined();
      });
    });

    describe('Patch (PATCH)', () => {
      it('should partially update item', async () => {
        const patched = await db.patch('posts', 1, { title: 'Patched Title' });

        expect(patched).toEqual({
          id: 1,
          title: 'Patched Title',
          author: 'Alice', // Should be preserved
        });
      });

      it('should ignore ID in patch data', async () => {
        const patched = await db.patch('posts', 1, { id: 999, title: 'Patched' });

        expect(patched).toEqual({
          id: 1, // Should remain 1
          title: 'Patched',
          author: 'Alice',
        });
      });

      it('should return undefined for non-existent item', async () => {
        const result = await db.patch('posts', 999, { title: 'Patched' });
        expect(result).toBeUndefined();
      });
    });

    describe('Delete', () => {
      it('should delete item', async () => {
        const deleted = await db.delete('posts', 1);
        expect(deleted).toBe(true);

        const item = db.getById('posts', 1);
        expect(item).toBeUndefined();
      });

      it('should return false for non-existent item', async () => {
        const deleted = await db.delete('posts', 999);
        expect(deleted).toBe(false);
      });

      it('should return false for non-collection', async () => {
        const deleted = await db.delete('nonexistent', 1);
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Singular Resources', () => {
    let db: Database;

    beforeEach(async () => {
      const testData = {
        profile: { name: 'John Doe', email: 'john@example.com' },
        posts: [{ id: 1, title: 'Post' }],
      };
      writeFileSync(testDbPath, JSON.stringify(testData));
      db = new Database(testDbPath);
      await db.init();
    });

    it('should identify collections vs singular resources', () => {
      expect(db.isCollection('posts')).toBe(true);
      expect(db.isCollection('profile')).toBe(false);
    });

    it('should update singular resource', async () => {
      const updated = await db.updateSingular('profile', {
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(updated).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(db.getCollection('profile')).toEqual(updated);
    });

    it('should create new singular resource', async () => {
      const created = await db.updateSingular('settings', {
        theme: 'dark',
        language: 'en',
      });

      expect(created).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });
  });

  describe('Configuration Options', () => {
    it('should use custom ID field', async () => {
      const testPath = resolve(__dirname, 'test-db-custom-id.json');
      writeFileSync(
        testPath,
        JSON.stringify({ posts: [{ _id: 1, title: 'Post 1' }] })
      );

      const db = new Database(testPath, { idField: '_id' });
      await db.init();

      const post = db.getById('posts', 1);
      expect(post).toEqual({ _id: 1, title: 'Post 1' });

      const newPost = await db.create('posts', { title: 'New' });
      expect(newPost).toHaveProperty('_id', 2);

      unlinkSync(testPath);
    });

    it('should use custom foreign key suffix', async () => {
      const db = new Database({}, { foreignKeySuffix: '_id' });
      await db.init();

      expect(db.getForeignKeySuffix()).toBe('_id');
    });

    it('should return ID field name', async () => {
      const db = new Database({});
      await db.init();

      expect(db.getIdField()).toBe('id');
    });
  });

  describe('Data Persistence', () => {
    it('should persist data to file after create', async () => {
      writeFileSync(testDbPath, JSON.stringify({ posts: [] }));
      const db = new Database(testDbPath);
      await db.init();

      await db.create('posts', { title: 'New Post' });

      // Read file directly
      const fileContent = JSON.parse(readFileSync(testDbPath, 'utf-8')) as { posts: unknown[] };
      expect(fileContent.posts.length).toBe(1);
    });

    it('should persist data after update', async () => {
      writeFileSync(testDbPath, JSON.stringify({ posts: [{ id: 1, title: 'Old' }] }));
      const db = new Database(testDbPath);
      await db.init();

      await db.update('posts', 1, { title: 'New' });

      const fileContent = JSON.parse(readFileSync(testDbPath, 'utf-8')) as {
        posts: Array<{ title: string }>;
      };
      expect(fileContent.posts[0]?.title).toBe('New');
    });

    it('should persist data after delete', async () => {
      writeFileSync(testDbPath, JSON.stringify({ posts: [{ id: 1, title: 'Post' }] }));
      const db = new Database(testDbPath);
      await db.init();

      await db.delete('posts', 1);

      const fileContent = JSON.parse(readFileSync(testDbPath, 'utf-8')) as { posts: unknown[] };
      expect(fileContent.posts.length).toBe(0);
    });
  });
});

import { readFileSync } from 'fs';
