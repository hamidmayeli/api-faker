# API Faker Examples

This directory contains example files demonstrating how to extend API Faker with custom routes and middlewares.

## Custom Routes

Custom routes allow you to rewrite URLs before they reach the API router. This is useful for:
- Creating URL aliases
- Supporting legacy API paths
- Mapping complex URLs to simpler ones
- Adding custom query parameters

### routes.json

The `routes.json` file contains URL rewrite rules as key-value pairs. Routes are tested in order, and only the first matching rule is applied.

```json
{
  "/api/*": "/$1",
  "/:resource/:id/show": "/:resource/:id",
  "/posts/:category": "/posts?category=:category",
  "/articles?id=:id": "/posts/:id",
  "/me": "/profile",
  "/news/top": "/news?_sort=date&_order=asc&_limit=10",
  "/api/posts/:postId/comments/:commentId": "/comments/:commentId"
}
```

**Pattern Types:**

1. **Wildcard (`*`)**: Captures everything and references it as `$1`
   ```json
   {
     "/api/*": "/$1"
   }
   ```
   - `/api/posts` → `/posts`
   - `/api/posts/1` → `/posts/1`

2. **Named Parameters (`:param`)**: Captures a path segment
   ```json
   {
     "/:resource/:id/show": "/:resource/:id"
   }
   ```
   - `/posts/1/show` → `/posts/1`
   - `/users/42/show` → `/users/42`

3. **Query String Mapping**: Add query parameters to the rewritten URL
   ```json
   {
     "/posts/:category": "/posts?category=:category"
   }
   ```
   - `/posts/javascript` → `/posts?category=javascript`

4. **Exact Match**: Simple one-to-one mapping
   ```json
   {
     "/me": "/profile"
   }
   ```
   - `/me` → `/profile`

**Usage:**

```bash
api-faker db.json --routes examples/routes.json
```

**Testing Examples:**

```bash
# Start with routes
api-faker db.json --routes examples/routes.json --port 3000

# Test the routes (assuming you have posts, news, profile in db.json)
curl http://localhost:3000/api/posts              # → /posts
curl http://localhost:3000/posts/1/show           # → /posts/1
curl http://localhost:3000/posts/javascript       # → /posts?category=javascript
curl http://localhost:3000/me                     # → /profile
curl http://localhost:3000/news/top               # → /news?_sort=date&_order=asc&_limit=10
```

## Custom Middleware

Custom middleware allows you to add functionality that runs on every request. This is useful for:
- Adding custom headers
- Logging requests
- Authentication/authorization
- Request transformation

### custom-middleware.cjs

This example shows how to add custom middleware using CommonJS format:

```javascript
module.exports = function(req, res, next) {
  // Add a custom header to all responses
  res.setHeader('X-Custom-API', 'API Faker');
  
  // Log custom information
  console.log(`[Custom Middleware] ${req.method} ${req.url}`);
  
  // Continue to next middleware
  next();
};
```

**Usage:**

```bash
api-faker db.json --middlewares examples/custom-middleware.cjs
```

**Middleware can:**
- Modify request objects
- Modify response objects
- End the request-response cycle
- Call the next middleware in the stack

**Example - Authentication Middleware:**

```javascript
// auth-middleware.cjs
module.exports = function(req, res, next) {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No authorization token' });
  }
  
  // Validate token (simplified example)
  if (token !== 'Bearer secret-token') {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  // Token is valid, continue
  next();
};
```

**Example - Request Timing Middleware:**

```javascript
// timing-middleware.cjs
module.exports = function(req, res, next) {
  const start = Date.now();
  
  // Add listener for when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  
  next();
};
```

## Combined Usage

You can use both custom routes and middlewares together:

```bash
api-faker db.json \\
  --routes examples/routes.json \\
  --middlewares examples/custom-middleware.cjs \\
  --port 3000
```

## ES Module Support

API Faker supports both CommonJS and ES modules for middlewares:

**ES Module (`.mjs`):**

```javascript
// custom-middleware.mjs
export default function(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();
}
```

**TypeScript (`.ts`):**

```typescript
// custom-middleware.ts
import { Request, Response, NextFunction } from 'express';

export default function(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next();
}
```

## Array of Middlewares

You can export an array of middleware functions:

```javascript
// multiple-middlewares.cjs
module.exports = [
  function(req, res, next) {
    console.log('First middleware');
    next();
  },
  function(req, res, next) {
    console.log('Second middleware');
    next();
  },
  function(req, res, next) {
    res.setHeader('X-Custom-API', 'API Faker');
    next();
  }
];
```

## Full Example

Create a complete custom API setup:

**1. Create a database (`db.json`):**

```json
{
  "posts": [
    { "id": 1, "title": "Hello World", "category": "javascript" },
    { "id": 2, "title": "TypeScript Basics", "category": "typescript" }
  ],
  "news": [
    { "id": 1, "title": "Breaking News", "date": "2026-01-01" },
    { "id": 2, "title": "Old News", "date": "2025-12-01" }
  ],
  "profile": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**2. Create route mappings (`routes.json`):**

```json
{
  "/api/*": "/$1",
  "/me": "/profile",
  "/news/top": "/news?_sort=date&_order=desc&_limit=1",
  "/posts/:category": "/posts?category=:category"
}
```

**3. Create middleware (`logging.cjs`):**

```javascript
module.exports = function(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
};
```

**4. Start the server:**

```bash
api-faker db.json \\
  --routes routes.json \\
  --middlewares logging.cjs \\
  --port 3000
```

**5. Test the API:**

```bash
# Test URL rewriting
curl http://localhost:3000/api/posts           # → /posts
curl http://localhost:3000/me                  # → /profile
curl http://localhost:3000/news/top            # → /news?_sort=date&_order=desc&_limit=1
curl http://localhost:3000/posts/javascript    # → /posts?category=javascript

# All requests will be logged by the custom middleware
```

## Configuration File

Instead of passing all options via command-line flags, you can use a configuration file. By default, API Faker looks for `api-faker.json` in the current directory.

### api-faker.json

The configuration file supports all CLI options in JSON format:

```json
{
  "port": 3000,
  "host": "localhost",
  "watch": false,
  "routes": "routes.json",
  "middlewares": "middleware.js",
  "static": "./public",
  "readOnly": false,
  "noCors": false,
  "noGzip": false,
  "delay": 0,
  "id": "id",
  "foreignKeySuffix": "Id",
  "quiet": false
}
```

**Available Options:**

- `port` (number): Server port (default: 3000)
- `host` (string): Server host (default: "localhost")
- `watch` (boolean): Watch file for changes (default: false)
- `routes` (string): Path to routes file
- `middlewares` (string): Path to middleware file
- `static` (string): Static files directory (default: "./public")
- `readOnly` (boolean): Allow only GET requests (default: false)
- `noCors` (boolean): Disable CORS (default: false)
- `noGzip` (boolean): Disable GZIP compression (default: false)
- `delay` (number): Delay in milliseconds for all responses
- `id` (string): Custom ID field name (default: "id")
- `foreignKeySuffix` (string): Foreign key suffix (default: "Id")
- `quiet` (boolean): Suppress log messages (default: false)

**Usage:**

```bash
# Uses default api-faker.json in current directory
api-faker db.json

# Use custom config file
api-faker db.json --config my-config.json

# CLI arguments override config file
api-faker db.json --port 4000  # Overrides port from config file
```

**Priority:**

CLI arguments take precedence over config file values. This allows you to set defaults in the config file and override them when needed.

**Example - Development vs Production:**

**dev.json:**
```json
{
  "port": 3000,
  "watch": true,
  "quiet": false
}
```

**prod.json:**
```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "readOnly": true,
  "quiet": true
}
```

```bash
# Development
api-faker db.json --config dev.json

# Production
api-faker db.json --config prod.json
```

## Notes

- **Route Order Matters**: Routes are tested in the order they appear in the JSON file. The first matching rule wins.
- **Middleware Order**: Custom middlewares run after built-in middlewares (CORS, compression) but before routes.
- **Query Strings**: Query strings in the original request are preserved when rewriting URLs.
- **File Formats**: Routes must be in JSON format. Middlewares support `.js`, `.cjs`, `.mjs`, and `.ts` files.
- **Config Priority**: CLI arguments override config file values.
