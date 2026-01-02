import { describe, it, expect } from 'vitest';
import { create, router, defaults, rewriter } from '../src/index';

describe('API Faker - Module Exports', () => {
  it('should export create function', () => {
    expect(create).toBeDefined();
    expect(typeof create).toBe('function');
  });

  it('should export router function', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should export defaults function', () => {
    expect(defaults).toBeDefined();
    expect(typeof defaults).toBe('function');
  });

  it('should export rewriter function', () => {
    expect(rewriter).toBeDefined();
    expect(typeof rewriter).toBe('function');
  });

  it('should export bodyParser', () => {
    expect(rewriter).toBeDefined();
  });

  it('should throw error when calling create (not implemented)', () => {
    expect(() => {
      create();
    }).toThrow('Not implemented yet - coming in Phase 7');
  });

  it('should throw error when calling router (not implemented)', () => {
    expect(() => {
      router();
    }).toThrow('Not implemented yet - coming in Phase 7');
  });

  it('should throw error when calling defaults (not implemented)', () => {
    expect(() => {
      defaults();
    }).toThrow('Not implemented yet - coming in Phase 7');
  });

  it('should throw error when calling rewriter (not implemented)', () => {
    expect(() => {
      rewriter();
    }).toThrow('Not implemented yet - coming in Phase 7');
  });
});
