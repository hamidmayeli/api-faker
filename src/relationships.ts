/**
 * Relationships module for handling _embed and _expand parameters
 */

import type { Database } from './database';

/**
 * Detect foreign key relationships based on naming conventions
 * 
 * @param collectionName - Name of the collection (e.g., 'posts')
 * @param foreignKeySuffix - Suffix for foreign keys (default: 'Id')
 * @returns Possible foreign key name (e.g., 'postId')
 * 
 * @example
 * getForeignKey('posts', 'Id') // 'postId'
 * getForeignKey('users', '_id') // 'user_id'
 */
export function getForeignKey(collectionName: string, foreignKeySuffix: string): string {
  // Remove trailing 's' for singular form
  const singular = collectionName.endsWith('s') 
    ? collectionName.slice(0, -1) 
    : collectionName;
  
  return `${singular}${foreignKeySuffix}`;
}

/**
 * Embed child resources into parent items
 * 
 * @param items - Parent items to embed children into
 * @param parentCollection - Name of parent collection
 * @param childCollection - Name of child collection
 * @param db - Database instance
 * @param idField - ID field name (default: 'id')
 * @param foreignKeySuffix - Foreign key suffix (default: 'Id')
 * @returns Items with embedded children
 * 
 * @example
 * embedChildren([{ id: 1 }], 'posts', 'comments', db)
 * // [{ id: 1, comments: [{ id: 1, postId: 1, body: '...' }] }]
 */
export function embedChildren<T extends Record<string, unknown>>(
  items: T[],
  parentCollection: string,
  childCollection: string,
  db: Database,
  idField: string,
  foreignKeySuffix: string
): T[] {
  const children = db.getCollection(childCollection);
  
  // If children collection doesn't exist or isn't an array, return items unchanged
  if (!Array.isArray(children)) {
    return items;
  }

  const foreignKey = getForeignKey(parentCollection, foreignKeySuffix);

  return items.map(item => {
    // Find all children that reference this parent
    const matchingChildren = children.filter(child => {
      if (typeof child !== 'object' || child === null) return false;
      const childFk = (child as Record<string, unknown>)[foreignKey];
      const parentId = item[idField];
      return childFk === parentId || String(childFk) === String(parentId);
    });

    return {
      ...item,
      [childCollection]: matchingChildren,
    };
  });
}

/**
 * Expand parent resource into child items
 * 
 * @param items - Child items to expand parent into
 * @param childCollection - Name of child collection
 * @param parentCollection - Name of parent collection
 * @param db - Database instance
 * @param idField - ID field name (default: 'id')
 * @param foreignKeySuffix - Foreign key suffix (default: 'Id')
 * @returns Items with expanded parent
 * 
 * @example
 * expandParent([{ id: 1, postId: 1 }], 'comments', 'posts', db)
 * // [{ id: 1, postId: 1, post: { id: 1, title: '...' } }]
 */
export function expandParent<T extends Record<string, unknown>>(
  items: T[],
  _childCollection: string,
  parentCollection: string,
  db: Database,
  idField: string,
  foreignKeySuffix: string
): T[] {
  const parents = db.getCollection(parentCollection);
  
  // If parent collection doesn't exist or isn't an array, return items unchanged
  if (!Array.isArray(parents)) {
    return items;
  }

  const foreignKey = getForeignKey(parentCollection, foreignKeySuffix);

  return items.map(item => {
    const foreignKeyValue: unknown = item[foreignKey];
    
    if (foreignKeyValue === undefined) {
      return item;
    }

    // Find the parent that matches this foreign key
    const parent: unknown = parents.find(p => {
      if (typeof p !== 'object' || p === null) return false;
      const parentRecord = p as Record<string, unknown>;
      const parentId: unknown = parentRecord[idField];
      // Handle both numeric and string IDs
      if (typeof foreignKeyValue === 'number' || typeof foreignKeyValue === 'string') {
        return parentId === foreignKeyValue || String(parentId) === String(foreignKeyValue);
      }
      return false;
    });

    if (!parent || typeof parent !== 'object') {
      return item;
    }

    // Use singular form for parent property name
    const parentPropName = parentCollection.endsWith('s')
      ? parentCollection.slice(0, -1)
      : parentCollection;

    return {
      ...item,
      [parentPropName]: parent as Record<string, unknown>,
    };
  });
}

/**
 * Apply relationship parameters (_embed, _expand) to query results
 * 
 * @param data - Query results
 * @param resource - Resource name
 * @param embed - Collections to embed
 * @param expand - Collections to expand
 * @param db - Database instance
 * @param idField - ID field name
 * @param foreignKeySuffix - Foreign key suffix
 * @returns Data with relationships applied
 * 
 * @example
 * applyRelationships(posts, 'posts', ['comments'], [], db)
 */
export function applyRelationships<T extends Record<string, unknown>>(
  data: T[],
  resource: string,
  embed: string[],
  expand: string[],
  db: Database,
  idField: string,
  foreignKeySuffix: string
): T[] {
  let result = data;

  // Apply embeds (include children)
  for (const childCollection of embed) {
    result = embedChildren(result, resource, childCollection, db, idField, foreignKeySuffix);
  }

  // Apply expands (include parent)
  for (const parentCollection of expand) {
    result = expandParent(result, resource, parentCollection, db, idField, foreignKeySuffix);
  }

  return result;
}

/**
 * Parse relationship parameters from query
 * 
 * @param query - Express query object
 * @returns Arrays of collections to embed and expand
 * 
 * @example
 * parseRelationships({ _embed: 'comments' }) // { embed: ['comments'], expand: [] }
 * parseRelationships({ _embed: ['comments', 'likes'] }) // { embed: ['comments', 'likes'], expand: [] }
 */
export function parseRelationships(query: Record<string, unknown>): {
  embed: string[];
  expand: string[];
} {
  const embed: string[] = [];
  const expand: string[] = [];

  // Parse _embed
  const embedParam = query._embed;
  if (typeof embedParam === 'string') {
    embed.push(...embedParam.split(','));
  } else if (Array.isArray(embedParam)) {
    for (const e of embedParam) {
      if (typeof e === 'string') {
        embed.push(e);
      }
    }
  }

  // Parse _expand
  const expandParam = query._expand;
  if (typeof expandParam === 'string') {
    expand.push(...expandParam.split(','));
  } else if (Array.isArray(expandParam)) {
    for (const e of expandParam) {
      if (typeof e === 'string') {
        expand.push(e);
      }
    }
  }

  return { embed, expand };
}
