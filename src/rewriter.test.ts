import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import express, { Express } from 'express';
import request from 'supertest';
import { loadRewriteRules, createRewriterMiddleware } from './rewriter';

describe('rewriter', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `rest_api_faker-rewriter-test-${String(Date.now())}`);
    mkdirSync(testDir, { recursive: true });
  });

  describe('loadRewriteRules', () => {
    it('should load valid JSON route mappings', async () => {
      const routesFile = join(testDir, 'routes.json');
      writeFileSync(
        routesFile,
        JSON.stringify({
          '/api/*': '/$1',
          '/me': '/profile',
        })
      );

      const rules = await loadRewriteRules(routesFile);

      expect(rules).toEqual({
        '/api/*': '/$1',
        '/me': '/profile',
      });

      rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error for non-object JSON', async () => {
      const routesFile = join(testDir, 'routes.json');
      writeFileSync(routesFile, '[]');

      await expect(loadRewriteRules(routesFile)).rejects.toThrow(
        'Routes file must contain a JSON object'
      );

      rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error for non-string values', async () => {
      const routesFile = join(testDir, 'routes.json');
      writeFileSync(
        routesFile,
        JSON.stringify({
          '/api/*': 123,
        })
      );

      await expect(loadRewriteRules(routesFile)).rejects.toThrow(
        "Route mapping for '/api/*' must be a string"
      );

      rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error for invalid JSON', async () => {
      const routesFile = join(testDir, 'routes.json');
      writeFileSync(routesFile, '{invalid json}');

      await expect(loadRewriteRules(routesFile)).rejects.toThrow('Failed to load routes');

      rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error for non-existent file', async () => {
      const routesFile = join(testDir, 'nonexistent.json');

      await expect(loadRewriteRules(routesFile)).rejects.toThrow('Failed to load routes');

      rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('createRewriterMiddleware', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
    });

    it('should rewrite wildcard patterns', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      // Add catch-all route
      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts');
      expect((response.body as { url: string }).url).toBe('/posts');
    });

    it('should rewrite exact matches', async () => {
      const rewriter = createRewriterMiddleware({
        '/me': '/profile',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/me');
      expect((response.body as { url: string }).url).toBe('/profile');
    });

    it('should rewrite named parameters', async () => {
      const rewriter = createRewriterMiddleware({
        '/:resource/:id/show': '/:resource/:id',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/posts/1/show');
      expect((response.body as { url: string }).url).toBe('/posts/1');
    });

    it('should rewrite to query strings', async () => {
      const rewriter = createRewriterMiddleware({
        '/news/top': '/news?_sort=date&_order=asc&_limit=10',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/news/top');
      expect((response.body as { url: string }).url).toBe('/news?_sort=date&_order=asc&_limit=10');
    });

    it('should rewrite parameters to query strings', async () => {
      const rewriter = createRewriterMiddleware({
        '/posts/:category': '/posts?category=:category',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/posts/javascript');
      expect((response.body as { url: string }).url).toBe('/posts?category=javascript');
    });

    it('should rewrite with multiple wildcards', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/v1/*': '/v1/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/v1/posts/1/comments');
      expect((response.body as { url: string }).url).toBe('/v1/posts/1/comments');
    });

    it('should apply only the first matching rule based on specificity', async () => {
      const rewriter = createRewriterMiddleware({
        '/posts/*': '/articles/$1',
        '/posts/:id': '/items/:id',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/posts/123');
      // :id pattern is more specific than * wildcard, so it matches first
      expect((response.body as { url: string }).url).toBe('/items/123');
    });

    it('should not rewrite URLs that do not match any rule', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/posts');
      expect((response.body as { url: string }).url).toBe('/posts');
    });

    it('should preserve query strings when rewriting', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts?_limit=10&_page=2');
      expect((response.body as { url: string }).url).toBe('/posts?_limit=10&_page=2');
    });

    it('should handle nested path parameters', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/posts/:postId/comments/:commentId': '/comments/:commentId',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts/1/comments/42');
      expect((response.body as { url: string }).url).toBe('/comments/42');
    });

    it('should handle wildcard at the end', async () => {
      const rewriter = createRewriterMiddleware({
        '/news/*': '/news',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/news/latest');
      expect((response.body as { url: string }).url).toBe('/news');
    });

    it('should handle multiple wildcards', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*/*': '/$1?name=$2',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/users/john');
      expect((response.body as { url: string }).url).toBe('/users?name=john');
    });

    it('should handle multiple wildcards with more path segments', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*/*': '/$1/$2',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts/comments/nested');
      expect((response.body as { url: string }).url).toBe('/posts/comments/nested');
    });

    it('should use prefix matching - rewrite URL with query string preserved', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts?id=1');
      expect((response.body as { url: string }).url).toBe('/posts?id=1');
    });

    it('should use prefix matching - not affect unmatched URLs', async () => {
      const rewriter = createRewriterMiddleware({
        '/me': '/profile',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/message');
      expect((response.body as { url: string }).url).toBe('/message');
    });

    it('should rewrite with prefix match and preserve complex query strings', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts?_sort=date&_order=asc&_limit=10');
      expect((response.body as { url: string }).url).toBe('/posts?_sort=date&_order=asc&_limit=10');
    });

    it('should rewrite with prefix match and preserve complex route parameters', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts/1/comments/42?_sort=date&_order=asc&_limit=10');
      expect((response.body as { url: string }).url).toBe('/posts/1/comments/42?_sort=date&_order=asc&_limit=10');
    });

    it('should rewrite with giving priority to exact matches over wildcards', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/*': '/$1',
        '/api/health': '/health-check',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/health');
      expect((response.body as { url: string }).url).toBe('/health-check');
    });

    it('should rewrite with giving priority to detailed match', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/posts/*': '/posts/$1',
        '/api/posts/hot': '/posts?sort=hot',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts/hot');
      expect((response.body as { url: string }).url).toBe('/posts?sort=hot');
    });

    it('should rewrite with giving priority to detailed match with wildcards', async () => {
      const rewriter = createRewriterMiddleware({
        '/api/posts/*': '/posts/$1',
        '/api/posts/*?sort=hot': '/comments?sort=hot',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/api/posts/comments?sort=hot');
      expect((response.body as { url: string }).url).toBe('/comments?sort=hot');
    });

    it('should support wildcards in query parameters', async () => {
      const rewriter = createRewriterMiddleware({
        '/v1/business/search?size=*&page=*&q=*': '/business?_limit=$1&_page=$2&q=$3',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/v1/business/search?size=2&page=3&q=test');
      expect((response.body as { url: string }).url).toBe('/business?_limit=2&_page=3&q=test');
    });

    it('should handle empty wildcard values in query parameters', async () => {
      const rewriter = createRewriterMiddleware({
        '/v1/business/search?size=*&page=*&q=*': '/business?_limit=$1&_page=$2&q=$3',
      });
      app.use(rewriter);

      app.use((req, res) => {
        res.json({ url: req.url });
      });

      const response = await request(app).get('/v1/business/search?size=2&page=2&q=');
      expect((response.body as { url: string }).url).toBe('/business?_limit=2&_page=2&q=');
    });
  });
});
