import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Database data structure
 */
export interface DatabaseData {
  [key: string]: unknown;
}

/**
 * Database configuration options
 */
export interface DatabaseOptions {
  idField?: string;
  foreignKeySuffix?: string;
}

/**
 * Database class for managing JSON data with lowdb
 */
export class Database {
  private db: Low<DatabaseData>;
  private filePath: string;
  private options: Required<DatabaseOptions>;

  /**
   * Creates a new Database instance
   * 
   * @param source - Path to JSON file or object with data
   * @param options - Database configuration options
   * 
   * @example
   * ```typescript
   * const db = new Database('db.json', { idField: 'id' });
   * await db.init();
   * ```
   */
  constructor(source: string | DatabaseData, options: DatabaseOptions = {}) {
    this.options = {
      idField: options.idField || 'id',
      foreignKeySuffix: options.foreignKeySuffix || 'Id',
    };

    if (typeof source === 'string') {
      this.filePath = resolve(source);
      const adapter = new JSONFile<DatabaseData>(this.filePath);
      this.db = new Low(adapter, {});
    } else {
      this.filePath = '';
      // For in-memory database with object data
      const adapter = new JSONFile<DatabaseData>(':memory:');
      this.db = new Low(adapter, source);
    }
  }

  /**
   * Initialize the database by reading from file or using provided data
   * 
   * @throws Error if file doesn't exist or contains invalid JSON
   */
  async init(): Promise<void> {
    if (this.filePath && !existsSync(this.filePath)) {
      throw new Error(`Database file not found: ${this.filePath}`);
    }

    await this.db.read();

    if (typeof this.db.data !== 'object') {
      this.db.data = {};
    }

    // Ensure all collections are arrays or objects
    for (const key in this.db.data) {
      const value = this.db.data[key];
      if (value !== null && typeof value !== 'object') {
        throw new Error(`Invalid data structure: ${key} must be an array or object`);
      }
    }
  }

  /**
   * Get all data from the database
   * 
   * @returns Complete database data
   */
  getData(): DatabaseData {
    return this.db.data;
  }

  /**
   * Get a specific collection (array) or resource (object)
   * 
   * @param name - Name of the collection/resource
   * @returns Collection array, resource object, or undefined
   */
  getCollection(name: string): unknown {
    return this.db.data[name];
  }

  /**
   * Get a single item from a collection by ID
   * 
   * @param collectionName - Name of the collection
   * @param id - ID of the item
   * @returns The item or undefined
   */
  getById(collectionName: string, id: string | number): unknown {
    const collection = this.db.data[collectionName];
    
    if (!Array.isArray(collection)) {
      return undefined;
    }

    return collection.find((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return record[this.options.idField] === id || record[this.options.idField] === Number(id);
    });
  }

  /**
   * Generate next ID for a collection
   * 
   * @param collectionName - Name of the collection
   * @returns Next available ID
   */
  generateId(collectionName: string): number {
    const collection = this.db.data[collectionName];
    
    if (!Array.isArray(collection)) {
      return 1;
    }

    let maxId = 0;
    for (const item of collection) {
      if (typeof item === 'object' && item !== null) {
        const record = item as Record<string, unknown>;
        const idValue: unknown = record[this.options.idField];
        if (typeof idValue === 'number' && idValue > maxId) {
          maxId = idValue;
        }
      }
    }

    return maxId + 1;
  }

  /**
   * Create a new item in a collection
   * 
   * @param collectionName - Name of the collection
   * @param data - Data to insert
   * @returns Created item with ID
   * @throws Error if collection is not an array
   */
  async create(collectionName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    let collection = this.db.data[collectionName];

    // Create collection if it doesn't exist
    if (!collection) {
      collection = [];
      this.db.data[collectionName] = collection;
    }

    if (!Array.isArray(collection)) {
      throw new Error(`Cannot create in ${collectionName}: not a collection`);
    }

    // Generate ID if not provided or use provided ID
    const idValue: unknown = data[this.options.idField] !== undefined 
      ? data[this.options.idField]
      : this.generateId(collectionName);

    // Check if ID already exists
    const existingItem = this.getById(collectionName, idValue as string | number);
    if (existingItem) {
      throw new Error(`Item with ${this.options.idField}=${String(idValue)} already exists`);
    }

    const newItem: Record<string, unknown> = { ...data, [this.options.idField]: idValue };
    collection.push(newItem);

    await this.save();
    return newItem;
  }

  /**
   * Update an item in a collection (full replacement)
   * 
   * @param collectionName - Name of the collection
   * @param id - ID of the item
   * @param data - New data (ID field will be preserved)
   * @returns Updated item or undefined if not found
   */
  async update(collectionName: string, id: string | number, data: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
    const collection = this.db.data[collectionName];
    
    if (!Array.isArray(collection)) {
      return undefined;
    }

    const index = collection.findIndex((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return record[this.options.idField] === id || record[this.options.idField] === Number(id);
    });

    if (index === -1) {
      return undefined;
    }

    // Preserve the ID (convert to number if it's a numeric string)
    const originalItem = collection[index] as Record<string, unknown>;
    const originalId: unknown = originalItem[this.options.idField];
    const updatedItem: Record<string, unknown> = { ...data, [this.options.idField]: originalId };
    collection[index] = updatedItem;

    await this.save();
    return updatedItem;
  }

  /**
   * Patch an item in a collection (partial update)
   * 
   * @param collectionName - Name of the collection
   * @param id - ID of the item
   * @param data - Partial data to merge (ID field will be ignored)
   * @returns Updated item or undefined if not found
   */
  async patch(collectionName: string, id: string | number, data: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
    const collection = this.db.data[collectionName];
    
    if (!Array.isArray(collection)) {
      return undefined;
    }

    const index = collection.findIndex((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return record[this.options.idField] === id || record[this.options.idField] === Number(id);
    });

    if (index === -1) {
      return undefined;
    }

    const currentItem = collection[index] as Record<string, unknown>;
    // Merge data but ignore ID field in the patch data
    const { [this.options.idField]: _ignoredId, ...patchData } = data;
    const patchedItem = { ...currentItem, ...patchData };

    collection[index] = patchedItem;

    await this.save();
    return patchedItem;
  }

  /**
   * Delete an item from a collection
   * 
   * @param collectionName - Name of the collection
   * @param id - ID of the item
   * @returns true if deleted, false if not found
   */
  async delete(collectionName: string, id: string | number): Promise<boolean> {
    const collection = this.db.data[collectionName];
    
    if (!Array.isArray(collection)) {
      return false;
    }

    const index = collection.findIndex((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return record[this.options.idField] === id || record[this.options.idField] === Number(id);
    });

    if (index === -1) {
      return false;
    }

    collection.splice(index, 1);
    await this.save();
    return true;
  }

  /**
   * Update or create a singular resource
   * 
   * @param resourceName - Name of the resource
   * @param data - Resource data
   * @returns Updated resource
   */
  async updateSingular(resourceName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.db.data[resourceName] = data;
    await this.save();
    return data;
  }

  /**
   * Save the database to file
   */
  async save(): Promise<void> {
    await this.db.write();
  }

  /**
   * Check if a resource is a collection (array) or singular (object)
   * 
   * @param name - Name of the resource
   * @returns true if collection, false if singular or doesn't exist
   */
  isCollection(name: string): boolean {
    return Array.isArray(this.db.data[name]);
  }

  /**
   * Get ID field name
   */
  getIdField(): string {
    return this.options.idField;
  }

  /**
   * Get foreign key suffix
   */
  getForeignKeySuffix(): string {
    return this.options.foreignKeySuffix;
  }
}
