import { describe, it, expect } from 'vitest';
import { compareSemver } from './semver';

describe('compareSemver', () => {
  it('correctly compares version components', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareSemver('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.8.1', '0.8.0')).toBeGreaterThan(0);
    expect(compareSemver('0.8.0', '0.8.1')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('handles empty or missing parts gracefully by defaulting to 0', () => {
    expect(compareSemver('1', '1.0.0')).toBe(0);
    expect(compareSemver('1.1', '1.1.0')).toBe(0);
    expect(compareSemver('1.2', '1.1')).toBeGreaterThan(0);
    expect(compareSemver('1', '1.2')).toBeLessThan(0);
  });
});
