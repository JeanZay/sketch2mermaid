import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './appVersion';
import pkg from '../../package.json';

describe('App Version Consistency', () => {
  it('should have consistent version between package.json and APP_VERSION', () => {
    expect(pkg.version).toBe(APP_VERSION);
  });
});
