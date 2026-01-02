import { describe, it, expect } from 'vitest';
import { parseQuery, applyQuery, generateLinkHeader } from './query';
import type { Request } from 'express';

describe('Query Processing - Phase 3', () => {
  describe('parseQuery', () => {
    it('should parse filters', () => {
      const req = {
        query: {
          title: 'test',
          author: 'john',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.filters).toEqual({ title: 'test', author: 'john' });
    });

    it('should parse multiple values for same filter', () => {
      const req = {
        query: {
          author: ['john', 'jane'],
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.filters).toEqual({ author: ['john', 'jane'] });
    });

    it('should parse _sort parameter', () => {
      const req = {
        query: {
          _sort: 'id,title',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.sort).toEqual(['id', 'title']);
    });

    it('should parse _order parameter', () => {
      const req = {
        query: {
          _order: 'desc,asc',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.order).toEqual(['desc', 'asc']);
    });

    it('should parse _page and _limit parameters', () => {
      const req = {
        query: {
          _page: '2',
          _limit: '10',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should parse _start and _end parameters', () => {
      const req = {
        query: {
          _start: '5',
          _end: '15',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.start).toBe(5);
      expect(result.end).toBe(15);
    });

    it('should parse full-text search parameter', () => {
      const req = {
        query: {
          q: 'search text',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.q).toBe('search text');
    });

    it('should parse operator filters (_gte, _lte, _ne, _like)', () => {
      const req = {
        query: {
          views_gte: '100',
          views_lte: '500',
          title_like: 'test',
          status_ne: 'draft',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.operators).toEqual({
        views: { gte: '100', lte: '500' },
        title: { like: 'test' },
        status: { ne: 'draft' },
      });
    });

    it('should ignore invalid page/limit values', () => {
      const req = {
        query: {
          _page: 'invalid',
          _limit: '-5',
        },
      } as unknown as Request;

      const result = parseQuery(req);
      expect(result.page).toBeUndefined();
      expect(result.limit).toBeUndefined();
    });
  });

  describe('applyQuery - Filtering', () => {
    const testData = [
      { id: 1, title: 'Post 1', author: 'Alice', views: 100 },
      { id: 2, title: 'Post 2', author: 'Bob', views: 200 },
      { id: 3, title: 'Post 3', author: 'Alice', views: 150 },
    ];

    it('should filter by exact match', () => {
      const result = applyQuery(testData, {
        filters: { author: 'Alice' },
        operators: {},
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(3);
      expect(result.total).toBe(2);
    });

    it('should filter by multiple fields', () => {
      const result = applyQuery(testData, {
        filters: { author: 'Alice', views: '150' },
        operators: {},
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(3);
    });

    it('should filter by multiple values (OR logic)', () => {
      const result = applyQuery(testData, {
        filters: { author: ['Alice', 'Bob'] },
        operators: {},
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(3);
    });

    it('should filter by nested properties', () => {
      const nestedData = [
        { id: 1, user: { name: 'Alice' } },
        { id: 2, user: { name: 'Bob' } },
      ];

      const result = applyQuery(nestedData, {
        filters: { 'user.name': 'Alice' },
        operators: {},
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(1);
    });

    it('should return empty array for no matches', () => {
      const result = applyQuery(testData, {
        filters: { author: 'Charlie' },
        operators: {},
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('applyQuery - Operators', () => {
    const testData = [
      { id: 1, title: 'Hello World', views: 100 },
      { id: 2, title: 'Testing', views: 250 },
      { id: 3, title: 'Hello TypeScript', views: 175 },
    ];

    it('should filter with _gte operator', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { views: { gte: '200' } },
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(2);
    });

    it('should filter with _lte operator', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { views: { lte: '150' } },
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(1);
    });

    it('should filter with _ne operator', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { views: { ne: '100' } },
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(2);
      expect(result.data[1]?.id).toBe(3);
    });

    it('should filter with _like operator (case-insensitive)', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { title: { like: 'hello' } },
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(3);
    });

    it('should combine multiple operators', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { views: { gte: '100', lte: '200' } },
        sort: [],
        order: [],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(3);
    });
  });

  describe('applyQuery - Full-Text Search', () => {
    const testData = [
      { id: 1, title: 'Hello World', content: 'Lorem ipsum' },
      { id: 2, title: 'Testing', content: 'Hello there' },
      { id: 3, title: 'TypeScript', content: 'Goodbye world' },
    ];

    it('should search across all string fields', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        q: 'hello',
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(2);
    });

    it('should be case-insensitive', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        q: 'WORLD',
      });

      expect(result.data).toHaveLength(2);
    });

    it('should work with partial matches', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        q: 'Type',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(3);
    });
  });

  describe('applyQuery - Sorting', () => {
    const testData = [
      { id: 3, title: 'C', views: 100 },
      { id: 1, title: 'A', views: 200 },
      { id: 2, title: 'B', views: 150 },
    ];

    it('should sort by single field (ascending)', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: ['id'],
        order: ['asc'],
      });

      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(2);
      expect(result.data[2]?.id).toBe(3);
    });

    it('should sort by single field (descending)', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: ['views'],
        order: ['desc'],
      });

      expect(result.data[0]?.views).toBe(200);
      expect(result.data[1]?.views).toBe(150);
      expect(result.data[2]?.views).toBe(100);
    });

    it('should sort by multiple fields', () => {
      const multiData = [
        { id: 1, category: 'B', views: 100 },
        { id: 2, category: 'A', views: 200 },
        { id: 3, category: 'A', views: 150 },
      ];

      const result = applyQuery(multiData, {
        filters: {},
        operators: {},
        sort: ['category', 'views'],
        order: ['asc', 'desc'],
      });

      expect(result.data[0]?.id).toBe(2); // A, 200
      expect(result.data[1]?.id).toBe(3); // A, 150
      expect(result.data[2]?.id).toBe(1); // B, 100
    });

    it('should default to ascending if order not specified', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: ['id'],
        order: [],
      });

      expect(result.data[0]?.id).toBe(1);
      expect(result.data[1]?.id).toBe(2);
      expect(result.data[2]?.id).toBe(3);
    });
  });

  describe('applyQuery - Pagination', () => {
    const testData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

    it('should paginate with _page and _limit', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        page: 2,
        limit: 10,
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0]?.id).toBe(11);
      expect(result.data[9]?.id).toBe(20);
      expect(result.total).toBe(25);
    });

    it('should handle last page with fewer items', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        page: 3,
        limit: 10,
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.id).toBe(21);
      expect(result.total).toBe(25);
    });

    it('should apply limit only if page not specified', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        limit: 5,
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.id).toBe(1);
    });
  });

  describe('applyQuery - Slicing', () => {
    const testData = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));

    it('should slice with _start and _end', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        start: 5,
        end: 10,
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.id).toBe(6);
      expect(result.data[4]?.id).toBe(10);
    });

    it('should slice with only _start', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        start: 15,
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.id).toBe(16);
    });

    it('should slice with only _end', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: {},
        sort: [],
        order: [],
        end: 5,
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0]?.id).toBe(1);
    });
  });

  describe('applyQuery - Combined Operations', () => {
    const testData = [
      { id: 1, title: 'Alpha', author: 'Alice', views: 100 },
      { id: 2, title: 'Beta', author: 'Bob', views: 250 },
      { id: 3, title: 'Gamma', author: 'Alice', views: 175 },
      { id: 4, title: 'Delta', author: 'Charlie', views: 300 },
      { id: 5, title: 'Epsilon', author: 'Alice', views: 80 },
    ];

    it('should apply filter + sort + pagination', () => {
      const result = applyQuery(testData, {
        filters: { author: 'Alice' },
        operators: {},
        sort: ['views'],
        order: ['desc'],
        page: 1,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe(3); // 175 views
      expect(result.data[1]?.id).toBe(1); // 100 views
      expect(result.total).toBe(3); // Total Alice posts
    });

    it('should apply operator + search + sort', () => {
      const result = applyQuery(testData, {
        filters: {},
        operators: { views: { gte: '100' } },
        sort: ['title'],
        order: ['asc'],
        q: 'a',
      });

      expect(result.data).toHaveLength(4);
      expect(result.data[0]?.title).toBe('Alpha');
      expect(result.data[1]?.title).toBe('Beta');
      expect(result.data[2]?.title).toBe('Delta');
      expect(result.data[3]?.title).toBe('Gamma');
    });
  });

  describe('generateLinkHeader', () => {
    const mockReq = {
      protocol: 'http',
      get: () => 'localhost:3000',
      path: '/posts',
      query: { _page: '2', _limit: '10', author: 'john' },
    } as unknown as Request;

    it('should generate Link header with all relations', () => {
      const result = generateLinkHeader(mockReq, 2, 10, 100);

      expect(result).toContain('rel="first"');
      expect(result).toContain('rel="prev"');
      expect(result).toContain('rel="next"');
      expect(result).toContain('rel="last"');
    });

    it('should not include prev on first page', () => {
      const result = generateLinkHeader(mockReq, 1, 10, 100);

      expect(result).toContain('rel="first"');
      expect(result).not.toContain('rel="prev"');
      expect(result).toContain('rel="next"');
      expect(result).toContain('rel="last"');
    });

    it('should not include next on last page', () => {
      const result = generateLinkHeader(mockReq, 10, 10, 100);

      expect(result).toContain('rel="first"');
      expect(result).toContain('rel="prev"');
      expect(result).not.toContain('rel="next"');
      expect(result).toContain('rel="last"');
    });
  });
});
