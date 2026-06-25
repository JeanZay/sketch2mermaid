import { describe, it, expect } from 'vitest';
import { getMermaidLikeOrthogonalEdgePath } from './edgeRouting';
import { Position } from '@xyflow/react';

describe('Mermaid-like Orthogonal Edge Routing', () => {
  it('produces valid SVG path string containing only M and L commands', () => {
    const [path, lx, ly] = getMermaidLikeOrthogonalEdgePath({
      sourceX: 100,
      sourceY: 100,
      targetX: 300,
      targetY: 200,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    // Should start with M and use only L for subsequent points
    expect(path).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)?( L \d+(\.\d+)? \d+(\.\d+)?)+$/);
    expect(path).not.toContain('C');
    expect(path).not.toContain('Q');
    expect(path).not.toContain('S');
    expect(path).not.toContain('NaN');
    expect(lx).not.toBeNaN();
    expect(ly).not.toBeNaN();
  });

  it('handles all 16 combinations of handle positions without error or NaN', () => {
    const positions = [Position.Left, Position.Right, Position.Top, Position.Bottom];
    for (const sPos of positions) {
      for (const tPos of positions) {
        const [path, lx, ly] = getMermaidLikeOrthogonalEdgePath({
          sourceX: 100,
          sourceY: 100,
          targetX: 200,
          targetY: 200,
          sourcePosition: sPos,
          targetPosition: tPos,
        });

        expect(path).toBeTruthy();
        expect(path).not.toContain('NaN');
        expect(lx).not.toBeNaN();
        expect(ly).not.toBeNaN();
      }
    }
  });

  it('nudges the label away from corners/bends to the midpoint of the longest segment', () => {
    // E.g., source: (0, 0) right, target: (100, 100) top.
    // path: (0, 0) -> (100, 0) -> (100, 100)
    // The segments are:
    // 1. (0, 0) -> (100, 0) (length 100)
    // 2. (100, 0) -> (100, 100) (length 100)
    // Total length = 200. Geometric midpoint is at targetLen = 100, which is exactly (100, 0) corner.
    // Distance from (100,0) to corner is 0 < 20px, so safeguard triggers and places label at the midpoint of
    // the longest segment. Since both are length 100, it selects one (either (50, 0) or (100, 50)).
    const [, lx, ly] = getMermaidLikeOrthogonalEdgePath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: Position.Right,
      targetPosition: Position.Top,
    });

    // The corner is at (100, 0)
    const distToCorner = Math.hypot(lx - 100, ly - 0);
    expect(distToCorner).toBeGreaterThanOrEqual(20);

    // It should be either (50, 0) or (100, 50)
    const isAtSegmentMidpoint = (lx === 50 && ly === 0) || (lx === 100 && ly === 50);
    expect(isAtSegmentMidpoint).toBe(true);
  });

  it('keeps label at geometric midpoint for straight horizontal or vertical paths', () => {
    // Horizontal line: (0, 0) -> (100, 0)
    const [, lx, ly] = getMermaidLikeOrthogonalEdgePath({
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    expect(lx).toBe(50);
    expect(ly).toBe(0);
  });
});
