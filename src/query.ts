/**
 * Query processing module for filtering, sorting, pagination, etc.
 */

import type { Request } from 'express';

/**
 * Query options extracted from request
 */
export interface QueryOptions {
  filters: Record<string, string | string[]>;
  operators: Record<string, Record<string, string>>;
  sort: string[];
  order: string[];
  page?: number;
  limit?: number;
  start?: number;
  end?: number;
  q?: string;
}

/**
 * Parse query parameters from request
 * 
 * @param req - Express request object
 * @returns Parsed query options
 * 
 * @example
 * parseQuery(req) // { filters: { title: 'value' }, sort: ['id'], order: ['asc'] }
 */
export function parseQuery(req: Request): QueryOptions {
  const query = req.query;
  const filters: Record<string, string | string[]> = {};
  const operators: Record<string, Record<string, string>> = {};
  const sort: string[] = [];
  const order: string[] = [];
  let page: number | undefined;
  let limit: number | undefined;
  let start: number | undefined;
  let end: number | undefined;
  let q: string | undefined;

  for (const [key, value] of Object.entries(query)) {
    // Skip non-string and non-array values
    const stringValue = typeof value === 'string' ? value : 
                       Array.isArray(value) && value.length > 0 && typeof value[0] === 'string' ? value[0] : 
                       null;
    
    if (stringValue === null && !Array.isArray(value)) {
      continue;
    }

    // Special query parameters
    if (key === '_sort') {
      if (typeof value === 'string') {
        sort.push(...value.split(','));
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') {
            sort.push(v);
          }
        }
      }
      continue;
    }

    if (key === '_order') {
      if (typeof value === 'string') {
        order.push(...value.split(','));
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') {
            order.push(v);
          }
        }
      }
      continue;
    }

    if (key === '_page' && stringValue) {
      const parsed = parseInt(stringValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        page = parsed;
      }
      continue;
    }

    if (key === '_limit' && stringValue) {
      const parsed = parseInt(stringValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
      continue;
    }

    if (key === '_start' && stringValue) {
      const parsed = parseInt(stringValue, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        start = parsed;
      }
      continue;
    }

    if (key === '_end' && stringValue) {
      const parsed = parseInt(stringValue, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        end = parsed;
      }
      continue;
    }

    if (key === 'q' && stringValue) {
      q = stringValue;
      continue;
    }

    // Operator filters (_gte, _lte, _ne, _like)
    const operatorMatch = key.match(/^(.+)_(gte|lte|ne|like)$/);
    if (operatorMatch && stringValue) {
      const field = operatorMatch[1];
      const operator = operatorMatch[2];
      
      if (field && operator) {
        if (!operators[field]) {
          operators[field] = {};
        }
        operators[field][operator] = stringValue;
      }
      continue;
    }

    // Regular filters
    if (typeof value === 'string') {
      filters[key] = value;
    } else if (Array.isArray(value)) {
      const stringValues = value.filter((v): v is string => typeof v === 'string');
      if (stringValues.length > 0) {
        filters[key] = stringValues;
      }
    }
  }

  const result: QueryOptions = {
    filters,
    operators,
    sort,
    order,
  };

  if (page !== undefined) result.page = page;
  if (limit !== undefined) result.limit = limit;
  if (start !== undefined) result.start = start;
  if (end !== undefined) result.end = end;
  if (q !== undefined) result.q = q;

  return result;
}

/**
 * Get nested property value from object
 * 
 * @param obj - Object to get property from
 * @param path - Dot-separated property path
 * @returns Property value or undefined
 * 
 * @example
 * getNestedValue({ user: { name: 'John' } }, 'user.name') // 'John'
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Check if item matches filter criteria
 * 
 * @param item - Item to check
 * @param filters - Filter criteria
 * @returns True if item matches all filters
 * 
 * @example
 * matchesFilters({ title: 'test' }, { title: 'test' }) // true
 */
function matchesFilters(item: unknown, filters: Record<string, string | string[]>): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  for (const [key, filterValue] of Object.entries(filters)) {
    const itemValue = getNestedValue(item, key);

    if (Array.isArray(filterValue)) {
      // Multiple values - item must match at least one
      const matched = filterValue.some(val => String(itemValue) === val);
      if (!matched) {
        return false;
      }
    } else {
      // Single value - exact match
      if (String(itemValue) !== filterValue) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if item matches operator criteria
 * 
 * @param item - Item to check
 * @param operators - Operator criteria
 * @returns True if item matches all operators
 * 
 * @example
 * matchesOperators({ age: 25 }, { age: { _gte: '18' } }) // true
 */
function matchesOperators(item: unknown, operators: Record<string, Record<string, string>>): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  for (const [key, ops] of Object.entries(operators)) {
    const itemValue = getNestedValue(item, key);

    for (const [operator, filterValue] of Object.entries(ops)) {
      if (operator === 'gte') {
        if (Number(itemValue) < Number(filterValue)) {
          return false;
        }
      } else if (operator === 'lte') {
        if (Number(itemValue) > Number(filterValue)) {
          return false;
        }
      } else if (operator === 'ne') {
        if (String(itemValue) === filterValue) {
          return false;
        }
      } else if (operator === 'like') {
        const itemStr = String(itemValue).toLowerCase();
        const filterStr = filterValue.toLowerCase();
        if (!itemStr.includes(filterStr)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Check if item matches full-text search
 * 
 * @param item - Item to check
 * @param searchText - Text to search for
 * @returns True if any string property contains search text
 * 
 * @example
 * matchesSearch({ title: 'Hello World' }, 'world') // true
 */
function matchesSearch(item: unknown, searchText: string): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }

  const lowerSearch = searchText.toLowerCase();

  function searchObject(obj: unknown): boolean {
    if (typeof obj === 'string') {
      return obj.toLowerCase().includes(lowerSearch);
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(searchObject);
    }

    return false;
  }

  return searchObject(item);
}

/**
 * Apply filtering, sorting, pagination, etc. to data array
 * 
 * @param data - Array of items to process
 * @param options - Query options
 * @returns Processed array and total count (before pagination)
 * 
 * @example
 * applyQuery([{ id: 1 }, { id: 2 }], { limit: 1 }) // { data: [{ id: 1 }], total: 2 }
 */
export function applyQuery<T>(
  data: T[],
  options: QueryOptions
): { data: T[]; total: number } {
  let result = [...data];

  // Apply full-text search
  if (options.q) {
    const searchText = options.q;
    result = result.filter(item => matchesSearch(item, searchText));
  }

  // Apply filters
  if (Object.keys(options.filters).length > 0) {
    result = result.filter(item => matchesFilters(item, options.filters));
  }

  // Apply operators
  if (Object.keys(options.operators).length > 0) {
    result = result.filter(item => matchesOperators(item, options.operators));
  }

  // Store total before pagination
  const total = result.length;

  // Apply sorting
  if (options.sort.length > 0) {
    const sortFields = options.sort;
    const sortOrders = options.order;

    result.sort((a, b) => {
      for (let i = 0; i < sortFields.length; i++) {
        const field = sortFields[i];
        if (!field) continue;
        
        const order = sortOrders[i] === 'desc' ? -1 : 1;

        const aVal = getNestedValue(a, field);
        const bVal = getNestedValue(b, field);

        if (aVal === bVal) continue;

        // Handle null/undefined
        if (aVal === undefined || aVal === null) return 1 * order;
        if (bVal === undefined || bVal === null) return -1 * order;

        // Compare values
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
      }
      return 0;
    });
  }

  // Apply slicing (_start and _end)
  if (options.start !== undefined || options.end !== undefined) {
    const start = options.start ?? 0;
    const end = options.end ?? result.length;
    result = result.slice(start, end);
  }
  // Apply pagination (_page and _limit)
  else if (options.page !== undefined && options.limit !== undefined) {
    const start = (options.page - 1) * options.limit;
    result = result.slice(start, start + options.limit);
  }
  // Apply limit only
  else if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return { data: result, total };
}

/**
 * Generate Link header for pagination
 * 
 * @param req - Express request object
 * @param page - Current page
 * @param limit - Items per page
 * @param total - Total number of items
 * @returns Link header value
 * 
 * @example
 * generateLinkHeader(req, 2, 10, 100) // '<...>; rel="first", <...>; rel="prev", ...'
 */
export function generateLinkHeader(
  req: Request,
  page: number,
  limit: number,
  total: number
): string {
  const host = req.get('host') ?? 'localhost';
  const baseUrl = `${req.protocol}://${host}${req.path}`;
  const query = new URLSearchParams(req.query as Record<string, string>);
  const lastPage = Math.ceil(total / limit);

  const links: string[] = [];

  // First page
  query.set('_page', '1');
  query.set('_limit', String(limit));
  links.push(`<${baseUrl}?${query.toString()}>; rel="first"`);

  // Previous page
  if (page > 1) {
    query.set('_page', String(page - 1));
    links.push(`<${baseUrl}?${query.toString()}>; rel="prev"`);
  }

  // Next page
  if (page < lastPage) {
    query.set('_page', String(page + 1));
    links.push(`<${baseUrl}?${query.toString()}>; rel="next"`);
  }

  // Last page
  query.set('_page', String(lastPage));
  links.push(`<${baseUrl}?${query.toString()}>; rel="last"`);

  return links.join(', ');
}
