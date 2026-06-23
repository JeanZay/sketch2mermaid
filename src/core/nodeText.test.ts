import { describe, test, expect } from 'vitest';
import { computeNodeFontSize } from './nodeText';

describe('computeNodeFontSize', () => {
  test('returns max font size for short label in large node', () => {
    const size = computeNodeFontSize({ label: 'OK', width: 300, height: 200 });
    expect(size).toBe(16); // capped at max
  });

  test('returns min font size for very long label in small node', () => {
    const size = computeNodeFontSize({
      label: 'This is an extremely long label that would need a very small font',
      width: 90,
      height: 44,
    });
    expect(size).toBe(10); // clamped at min
  });

  test('scales down with label length', () => {
    const short = computeNodeFontSize({ label: 'Hi', width: 140, height: 56 });
    const long = computeNodeFontSize({ label: 'Hello World Process', width: 140, height: 56 });
    expect(short).toBeGreaterThanOrEqual(long);
  });

  test('scales up with node width', () => {
    const narrow = computeNodeFontSize({ label: 'Test Label', width: 90, height: 56 });
    const wide = computeNodeFontSize({ label: 'Test Label', width: 300, height: 56 });
    expect(wide).toBeGreaterThanOrEqual(narrow);
  });

  test('respects custom min and max', () => {
    const size = computeNodeFontSize({ label: 'X', width: 500, height: 500, min: 12, max: 20 });
    expect(size).toBe(20);
    const tiny = computeNodeFontSize({
      label: 'A very very long label for testing minimum clamp',
      width: 50,
      height: 30,
      min: 8,
      max: 14,
    });
    expect(tiny).toBe(8);
  });

  test('handles empty label gracefully', () => {
    const size = computeNodeFontSize({ label: '', width: 140, height: 56 });
    expect(size).toBeGreaterThanOrEqual(10);
    expect(size).toBeLessThanOrEqual(16);
  });

  test('handles whitespace-only label', () => {
    const size = computeNodeFontSize({ label: '   ', width: 140, height: 56 });
    expect(size).toBeGreaterThanOrEqual(10);
    expect(size).toBeLessThanOrEqual(16);
  });
});
