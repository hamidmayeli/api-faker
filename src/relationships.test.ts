import { describe, it, expect } from 'vitest';
import {
  getForeignKey,
  embedChildren,
  expandParent,
  applyRelationships,
  parseRelationships,
} from './relationships.js';
import type { Database } from './database.js';

// Helper to create a mock database
function createMockDatabase(data: Record<string, unknown[]>): Database {
  return {
    getCollection: (name: string) => data[name] || [],
  } as Database;
}

describe('Relationships', () => {
  describe('getForeignKey', () => {
    it('should generate foreign key with default suffix', () => {
      expect(getForeignKey('user', 'Id')).toBe('userId');
      expect(getForeignKey('post', 'Id')).toBe('postId');
      expect(getForeignKey('comment', 'Id')).toBe('commentId');
    });

    it('should generate foreign key with custom suffix', () => {
      expect(getForeignKey('user', '_id')).toBe('user_id');
      expect(getForeignKey('post', '_key')).toBe('post_key');
    });

    it('should handle plural collection names', () => {
      // The function removes trailing 's' to singularize
      expect(getForeignKey('users', 'Id')).toBe('userId');
      expect(getForeignKey('posts', 'Id')).toBe('postId');
      expect(getForeignKey('categories', 'Id')).toBe('categorieId'); // 'categories' -> 'categorie'
    });
  });

  describe('embedChildren', () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const posts = [
      { id: 1, userId: 1, title: 'Post 1' },
      { id: 2, userId: 1, title: 'Post 2' },
      { id: 3, userId: 2, title: 'Post 3' },
    ];

    const comments = [
      { id: 1, postId: 1, text: 'Comment 1' },
      { id: 2, postId: 1, text: 'Comment 2' },
      { id: 3, postId: 2, text: 'Comment 3' },
    ];

    const db = createMockDatabase({
      users,
      posts,
      comments,
    });

    it('should embed children into parent records', () => {
      const result = embedChildren(users, 'users', 'posts', db, 'id', 'Id');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Alice',
        posts: [
          { id: 1, userId: 1, title: 'Post 1' },
          { id: 2, userId: 1, title: 'Post 2' },
        ],
      });
      expect(result[1]).toMatchObject({
        id: 2,
        name: 'Bob',
        posts: [{ id: 3, userId: 2, title: 'Post 3' }],
      });
    });

    it('should handle multiple child collections', () => {
      const result = embedChildren(posts, 'posts', 'comments', db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        userId: 1,
        title: 'Post 1',
        comments: [
          { id: 1, postId: 1, text: 'Comment 1' },
          { id: 2, postId: 1, text: 'Comment 2' },
        ],
      });
      expect(result[1]).toMatchObject({
        id: 2,
        userId: 1,
        title: 'Post 2',
        comments: [{ id: 3, postId: 2, text: 'Comment 3' }],
      });
      expect(result[2]).toMatchObject({
        id: 3,
        userId: 2,
        title: 'Post 3',
        comments: [],
      });
    });

    it('should handle empty children arrays', () => {
      const result = embedChildren([{ id: 99, name: 'New User' }], 'users', 'posts', db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 99,
        name: 'New User',
        posts: [],
      });
    });

    it('should handle non-existent child collections', () => {
      const result = embedChildren(users, 'users', 'nonexistent', db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Alice',
        nonexistent: [],
      });
    });

    it('should handle custom foreign key suffix', () => {
      const customDb = createMockDatabase({
        users: [{ user_id: 1, name: 'Alice' }],
        posts: [{ id: 1, user_id: 1, title: 'Post 1' }],
      });

      const result = embedChildren(customDb.getCollection('users') as Array<Record<string, unknown>>, 'users', 'posts', customDb, 'user_id', '_id');
      
      expect(result[0]).toMatchObject({
        user_id: 1,
        name: 'Alice',
        posts: [{ id: 1, user_id: 1, title: 'Post 1' }],
      });
    });
  });

  describe('expandParent', () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const posts = [
      { id: 1, userId: 1, title: 'Post 1' },
      { id: 2, userId: 1, title: 'Post 2' },
      { id: 3, userId: 2, title: 'Post 3' },
    ];

    const db = createMockDatabase({
      users,
      posts,
    });

    it('should expand parent into child records', () => {
      const result = expandParent(posts, 'posts', 'users', db, 'id', 'Id');
      
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 1,
        userId: 1,
        title: 'Post 1',
        user: { id: 1, name: 'Alice' },
      });
      expect(result[1]).toMatchObject({
        id: 2,
        userId: 1,
        title: 'Post 2',
        user: { id: 1, name: 'Alice' },
      });
      expect(result[2]).toMatchObject({
        id: 3,
        userId: 2,
        title: 'Post 3',
        user: { id: 2, name: 'Bob' },
      });
    });

    it('should handle multiple parent collections', () => {
      const categories = [{ id: 1, name: 'Tech' }];
      const postsWithCategory = [
        { id: 1, userId: 1, categorieId: 1, title: 'Post 1' }, // Note: categorieId not categoryId
      ];

      const fullDb = createMockDatabase({
        users,
        categories,
        posts: postsWithCategory,
      });

      let result = expandParent(postsWithCategory, 'posts', 'users', fullDb, 'id', 'Id');
      result = expandParent(result, 'posts', 'categories', fullDb, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        userId: 1,
        categorieId: 1,
        title: 'Post 1',
        user: { id: 1, name: 'Alice' },
        categorie: { id: 1, name: 'Tech' }, // Note: categorie not category
      });
    });

    it('should handle missing parent', () => {
      const orphanPost = [{ id: 99, userId: 999, title: 'Orphan Post' }];
      const result = expandParent(orphanPost, 'posts', 'users', db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 99,
        userId: 999,
        title: 'Orphan Post',
      });
      expect(result[0]).not.toHaveProperty('user');
    });

    it('should handle non-existent parent collection', () => {
      const result = expandParent(posts, 'posts', 'nonexistent', db, 'id', 'Id');
      
      expect(result).toHaveLength(3);
      expect(result[0]).not.toHaveProperty('nonexistent');
    });

    it('should handle custom foreign key suffix', () => {
      const customDb = createMockDatabase({
        users: [{ user_id: 1, name: 'Alice' }],
        posts: [{ id: 1, user_id: 1, title: 'Post 1' }],
      });

      const result = expandParent(customDb.getCollection('posts') as Array<Record<string, unknown>>, 'posts', 'users', customDb, 'user_id', '_id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        user_id: 1,
        title: 'Post 1',
        user: { user_id: 1, name: 'Alice' },
      });
    });
  });

  describe('applyRelationships', () => {
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const posts = [
      { id: 1, userId: 1, title: 'Post 1' },
      { id: 2, userId: 1, title: 'Post 2' },
      { id: 3, userId: 2, title: 'Post 3' },
    ];

    const comments = [
      { id: 1, postId: 1, text: 'Comment 1' },
      { id: 2, postId: 1, text: 'Comment 2' },
    ];

    const db = createMockDatabase({
      users,
      posts,
      comments,
    });

    it('should apply both embed and expand', () => {
      const result = applyRelationships(
        posts,
        'posts',
        ['comments'],
        ['users'],
        db,
        'id',
        'Id'
      );
      
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 1,
        userId: 1,
        title: 'Post 1',
        user: { id: 1, name: 'Alice' },
        comments: [
          { id: 1, postId: 1, text: 'Comment 1' },
          { id: 2, postId: 1, text: 'Comment 2' },
        ],
      });
    });

    it('should handle only embed', () => {
      const result = applyRelationships(users, 'users', ['posts'], [], db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Alice',
        posts: [
          { id: 1, userId: 1, title: 'Post 1' },
          { id: 2, userId: 1, title: 'Post 2' },
        ],
      });
      expect(result[0]).not.toHaveProperty('user');
    });

    it('should handle only expand', () => {
      const result = applyRelationships(posts, 'posts', [], ['users'], db, 'id', 'Id');
      
      expect(result[0]).toMatchObject({
        id: 1,
        userId: 1,
        title: 'Post 1',
        user: { id: 1, name: 'Alice' },
      });
      expect(result[0]).not.toHaveProperty('comments');
    });

    it('should handle no relationships', () => {
      const result = applyRelationships(posts, 'posts', [], [], db, 'id', 'Id');
      
      expect(result).toEqual(posts);
    });
  });

  describe('parseRelationships', () => {
    it('should parse single _embed parameter', () => {
      const query = { _embed: 'posts' };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual(['posts']);
      expect(expand).toEqual([]);
    });

    it('should parse multiple _embed parameters', () => {
      const query = { _embed: ['posts', 'comments'] };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual(['posts', 'comments']);
      expect(expand).toEqual([]);
    });

    it('should parse single _expand parameter', () => {
      const query = { _expand: 'user' };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual([]);
      expect(expand).toEqual(['user']);
    });

    it('should parse multiple _expand parameters', () => {
      const query = { _expand: ['user', 'category'] };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual([]);
      expect(expand).toEqual(['user', 'category']);
    });

    it('should parse both _embed and _expand', () => {
      const query = { _embed: 'comments', _expand: 'user' };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual(['comments']);
      expect(expand).toEqual(['user']);
    });

    it('should handle missing relationship parameters', () => {
      const query = {};
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual([]);
      expect(expand).toEqual([]);
    });

    it('should handle empty arrays', () => {
      const query = { _embed: [], _expand: [] };
      const { embed, expand } = parseRelationships(query);
      
      expect(embed).toEqual([]);
      expect(expand).toEqual([]);
    });
  });
});
