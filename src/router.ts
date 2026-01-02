import { Router, Request, Response, NextFunction } from 'express';
import { Database } from './database';

/**
 * Helper to safely get route param (Express guarantees route params exist)
 */
function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (value === undefined) {
    throw new Error(`Route parameter '${name}' is missing`);
  }
  return value;
}

/**
 * Router configuration options
 */
export interface RouterOptions {
  idField?: string;
  foreignKeySuffix?: string;
  readOnly?: boolean;
}

/**
 * Create API Faker router with CRUD operations
 * 
 * @param db - Database instance
 * @param options - Router configuration options
 * @returns Express router
 * 
 * @example
 * ```typescript
 * const db = new Database('db.json');
 * await db.init();
 * const router = createRouter(db);
 * app.use(router);
 * ```
 */
export function createRouter(db: Database, options: Partial<RouterOptions> = {}): Router {
  const router = Router();
  const readOnly = options.readOnly || false;

  /**
   * Validate Content-Type for write operations
   */
  const validateContentType = (req: Request, _res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      // Express still parses but we should warn about missing header
      // In real json-server, this would still work but without actual data modification
      console.warn('Warning: Content-Type should be application/json');
    }
    next();
  };

  /**
   * GET /db - Return entire database
   */
  router.get('/db', (_req: Request, res: Response) => {
    res.json(db.getData());
  });

  /**
   * GET /:resource - Get all items in a collection or singular resource
   */
  router.get('/:resource', (req: Request, res: Response): void => {
    const resource = getParam(req, 'resource');
    const data = db.getCollection(resource);

    if (data === undefined) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    res.json(data);
  });

  /**
   * GET /:resource/:id - Get single item by ID
   */
  router.get('/:resource/:id', (req: Request, res: Response): void => {
    const resource = getParam(req, 'resource');
    const id = getParam(req, 'id');

    // Check if resource is a collection
    if (!db.isCollection(resource)) {
      res.status(404).json({ error: `Collection '${resource}' not found` });
      return;
    }

    const item = db.getById(resource, id);

    if (!item) {
      res.status(404).json({ error: `Item with id '${id}' not found in '${resource}'` });
      return;
    }

    res.json(item);
  });

  /**
   * POST /:resource - Create new item
   */
  router.post('/:resource', validateContentType, async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const data = req.body as Record<string, unknown>;

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    try {
      // Handle singular resources
      if (!db.isCollection(resource) && db.getCollection(resource) !== undefined) {
        const updated = await db.updateSingular(resource, data);
        return res.status(200).json(updated);
      }

      // Create in collection
      const created = await db.create(resource, data);
      return res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * PUT /:resource/:id - Full update of item
   */
  router.put('/:resource/:id', validateContentType, async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const id = getParam(req, 'id');
    const data = req.body as Record<string, unknown>;

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    if (!db.isCollection(resource)) {
      return res.status(404).json({ error: `Collection '${resource}' not found` });
    }

    try {
      const updated = await db.update(resource, id, data);
      
      if (!updated) {
        return res.status(404).json({ error: `Item with id '${id}' not found in '${resource}'` });
      }

      return res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * PATCH /:resource/:id - Partial update of item
   */
  router.patch('/:resource/:id', validateContentType, async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const id = getParam(req, 'id');
    const data = req.body as Record<string, unknown>;

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    if (!db.isCollection(resource)) {
      return res.status(404).json({ error: `Collection '${resource}' not found` });
    }

    try {
      const patched = await db.patch(resource, id, data);
      
      if (!patched) {
        return res.status(404).json({ error: `Item with id '${id}' not found in '${resource}'` });
      }

      return res.json(patched);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * PUT /:resource - Full update of singular resource
   */
  router.put('/:resource', validateContentType, async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const data = req.body as Record<string, unknown>;

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // Only allow for singular resources (objects, not arrays)
    if (db.isCollection(resource)) {
      return res.status(400).json({ error: `Cannot PUT to collection '${resource}'. Use POST or PUT /${resource}/:id` });
    }

    try {
      const updated = await db.updateSingular(resource, data);
      return res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * PATCH /:resource - Partial update of singular resource
   */
  router.patch('/:resource', validateContentType, async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const data = req.body as Record<string, unknown>;

    if (typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // Only allow for singular resources
    if (db.isCollection(resource)) {
      return res.status(400).json({ error: `Cannot PATCH collection '${resource}'. Use PATCH /${resource}/:id` });
    }

    const current = db.getCollection(resource) as Record<string, unknown> | undefined;
    
    if (!current || typeof current !== 'object') {
      return res.status(404).json({ error: `Resource '${resource}' not found` });
    }

    try {
      const merged = { ...current, ...data };
      const updated = await db.updateSingular(resource, merged);
      return res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * DELETE /:resource/:id - Delete item by ID
   */
  router.delete('/:resource/:id', async (req: Request, res: Response) => {
    if (readOnly) {
      return res.status(403).json({ error: 'Read-only mode enabled' });
    }

    const resource = getParam(req, 'resource');
    const id = getParam(req, 'id');

    if (!db.isCollection(resource)) {
      return res.status(404).json({ error: `Collection '${resource}' not found` });
    }

    const deleted = await db.delete(resource, id);

    if (!deleted) {
      return res.status(404).json({ error: `Item with id '${id}' not found in '${resource}'` });
    }

    // Return 204 No Content
    return res.status(204).send();
  });

  return router;
}
