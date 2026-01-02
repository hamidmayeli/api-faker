import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/database';
import { createServer } from '../src/server';
import supertest from 'supertest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Router Integration Tests', () => {
  const testDbPath = resolve(__dirname, 'test-api-db.json');
  let request: ReturnType<typeof supertest>;
  let db: Database;

  beforeEach(async () => {
    const testData = {
      posts: [
        { id: 1, title: 'Post 1', author: 'Alice', views: 100 },
        { id: 2, title: 'Post 2', author: 'Bob', views: 200 },
      ],
      comments: [
        { id: 1, body: 'Comment 1', postId: 1 },
        { id: 2, body: 'Comment 2', postId: 1 },
      ],
      profile: { name: 'John Doe', email: 'john@example.com' },
    };

    writeFileSync(testDbPath, JSON.stringify(testData));
    db = new Database(testDbPath);
    await db.init();
    const app = createServer(db, { quiet: true });
    request = supertest(app);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('GET Operations', () => {
    it('should get all items in a collection', async () => {
      const response = await request.get('/posts');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as unknown[]).length).toBe(2);
    });

    it('should get single item by ID', async () => {
      const response = await request.get('/posts/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        title: 'Post 1',
        author: 'Alice',
        views: 100,
      });
    });

    it('should get item by string ID', async () => {
      const response = await request.get('/posts/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 2);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request.get('/posts/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request.get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should get singular resource', async () => {
      const response = await request.get('/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should get entire database with /db', async () => {
      const response = await request.get('/db');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('comments');
      expect(response.body).toHaveProperty('profile');
    });
  });

  describe('POST Operations', () => {
    it('should create new item with auto-generated ID', async () => {
      const newPost = { title: 'New Post', author: 'Charlie' };
      const response = await request.post('/posts').send(newPost);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 3);
      expect(response.body).toMatchObject(newPost);
    });

    it('should create item with provided ID', async () => {
      const newPost = { id: 10, title: 'Custom ID Post' };
      const response = await request.post('/posts').send(newPost);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 10);
    });

    it('should return 400 for duplicate ID', async () => {
      const duplicate = { id: 1, title: 'Duplicate' };
      const response = await request.post('/posts').send(duplicate);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid body', async () => {
      const response = await request.post('/posts').send(null as unknown as object);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should create new collection if it does not exist', async () => {
      const newItem = { text: 'New item' };
      const response = await request.post('/newcollection').send(newItem);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 1);
    });

    it('should update singular resource with POST', async () => {
      const updated = { name: 'Jane Doe', email: 'jane@example.com' };
      const response = await request.post('/profile').send(updated);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updated);
    });
  });

  describe('PUT Operations', () => {
    it('should fully update item', async () => {
      const updated = { title: 'Updated Post' };
      const response = await request.put('/posts/1').send(updated);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 1, title: 'Updated Post' });
      expect(response.body).not.toHaveProperty('author');
    });

    it('should preserve ID even if different ID provided', async () => {
      const updated = { id: 999, title: 'Updated' };
      const response = await request.put('/posts/1').send(updated);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request.put('/posts/999').send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should update singular resource with PUT', async () => {
      const updated = { name: 'Jane Doe' };
      const response = await request.put('/profile').send(updated);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name: 'Jane Doe' });
      expect(response.body).not.toHaveProperty('email');
    });

    it('should return 400 when trying to PUT to collection without ID', async () => {
      const response = await request.put('/posts').send({ title: 'Invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH Operations', () => {
    it('should partially update item', async () => {
      const patch = { title: 'Patched Title' };
      const response = await request.patch('/posts/1').send(patch);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', 'Patched Title');
      expect(response.body).toHaveProperty('author', 'Alice'); // Preserved
      expect(response.body).toHaveProperty('views', 100); // Preserved
    });

    it('should ignore ID in patch data', async () => {
      const patch = { id: 999, title: 'Patched' };
      const response = await request.patch('/posts/1').send(patch);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1); // ID not changed
      expect(response.body).toHaveProperty('title', 'Patched');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request.patch('/posts/999').send({ title: 'Patched' });

      expect(response.status).toBe(404);
    });

    it('should partially update singular resource with PATCH', async () => {
      const patch = { name: 'Jane Doe' };
      const response = await request.patch('/profile').send(patch);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Jane Doe');
      expect(response.body).toHaveProperty('email', 'john@example.com'); // Preserved
    });

    it('should return 400 when trying to PATCH collection without ID', async () => {
      const response = await request.patch('/posts').send({ title: 'Invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE Operations', () => {
    it('should delete item', async () => {
      const response = await request.delete('/posts/1');

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      // Verify deletion
      const getResponse = await request.get('/posts/1');
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request.delete('/posts/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when trying to delete from non-collection', async () => {
      const response = await request.delete('/profile/1');

      expect(response.status).toBe(404);
    });
  });

  describe('Read-Only Mode', () => {
    let readOnlyRequest: ReturnType<typeof supertest>;
    const readOnlyPath = resolve(__dirname, 'test-readonly-db.json');

    beforeEach(async () => {
      const testData = {
        posts: [{ id: 1, title: 'Post 1' }],
      };
      writeFileSync(readOnlyPath, JSON.stringify(testData));
      const readOnlyDb = new Database(readOnlyPath);
      await readOnlyDb.init();
      const app = createServer(readOnlyDb, { readOnly: true, quiet: true });
      readOnlyRequest = supertest(app);
    });

    afterEach(() => {
      if (existsSync(readOnlyPath)) {
        unlinkSync(readOnlyPath);
      }
    });

    it('should allow GET in read-only mode', async () => {
      const response = await readOnlyRequest.get('/posts');

      expect(response.status).toBe(200);
    });

    it('should block POST in read-only mode', async () => {
      const response = await readOnlyRequest.post('/posts').send({ title: 'New' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should block PUT in read-only mode', async () => {
      const response = await readOnlyRequest.put('/posts/1').send({ title: 'Updated' });

      expect(response.status).toBe(403);
    });

    it('should block PATCH in read-only mode', async () => {
      const response = await readOnlyRequest.patch('/posts/1').send({ title: 'Patched' });

      expect(response.status).toBe(403);
    });

    it('should block DELETE in read-only mode', async () => {
      const response = await readOnlyRequest.delete('/posts/1');

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request
        .post('/posts')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request.get('/unknown-endpoint-that-does-not-exist');

      expect(response.status).toBe(404);
    });
  });

  describe('Data Persistence', () => {
    it('should persist created items', async () => {
      const newPost = { title: 'Persisted Post' };
      await request.post('/posts').send(newPost);

      // Read database file directly
      const fileData = JSON.parse(readFileSync(testDbPath, 'utf-8')) as { posts: unknown[] };
      expect(fileData.posts).toHaveLength(3);
      expect(fileData.posts[2]).toMatchObject(newPost);
    });

    it('should persist updates', async () => {
      await request.put('/posts/1').send({ title: 'Updated Post' });

      // Read database file directly
      const fileData = JSON.parse(readFileSync(testDbPath, 'utf-8')) as { posts: Array<{ id: number; title: string }> };
      expect(fileData.posts[0]).toEqual({ id: 1, title: 'Updated Post' });
    });

    it('should persist deletions', async () => {
      await request.delete('/posts/1');

      // Read database file directly
      const fileData = JSON.parse(readFileSync(testDbPath, 'utf-8')) as { posts: Array<{ id: number }> };
      expect(fileData.posts).toHaveLength(1);
      expect(fileData.posts.find((p) => p.id === 1)).toBeUndefined();
    });
  });
});
