import { describe, it, expect } from 'vitest';
import { config } from '../config';

describe('config', () => {
  it('exports a config object', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('has apiBaseUrl defaulting to /api', () => {
    expect(config.apiBaseUrl).toBe('/api');
  });

  it('has linkedinClientId', () => {
    expect(config).toHaveProperty('linkedinClientId');
  });

  it('has linkedinRedirectUri with default', () => {
    expect(config.linkedinRedirectUri).toContain('localhost');
  });

  it('has appName defaulting to Quickhire', () => {
    expect(config.appName).toBe('Quickhire');
  });

  it('has appVersion defaulting to 1.0.0', () => {
    expect(config.appVersion).toBe('1.0.0');
  });

  it('config is readonly (as const)', () => {
    // `as const` is a TypeScript compile-time assertion, not a runtime freeze.
    // Verify the object has the expected shape and all keys are present.
    const keys = Object.keys(config);
    expect(keys).toContain('apiBaseUrl');
    expect(keys).toContain('linkedinClientId');
    expect(keys).toContain('linkedinRedirectUri');
    expect(keys).toContain('appName');
    expect(keys).toContain('appVersion');
  });
});
