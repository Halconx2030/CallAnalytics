import { describe, expect, it } from 'vitest';

describe('Project setup', () => {
  it('should have a working test environment', () => {
    expect(true).toBe(true);
  });

  it('should have correct environment variables', () => {
    expect(process.env['NODE_ENV']).toBe('test');
  });
});
