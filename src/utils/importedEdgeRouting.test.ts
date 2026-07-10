import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { getCanvasEdgePath, getMermaidLikeOrthogonalEdgePath } from './edgeRouting';
import {
  clipEdgePointsToNodeBoundaries,
  generateImportedEdgePath,
  generateRoundedPath,
  getImportedEdgePath,
  getPathLengthMidpoint,
} from './importedEdgeRouting';

describe('imported Mermaid edge routing', () => {
  it('clips the first and last points to rectangle boundaries while keeping inner points', () => {
    const inner = { x: 20, y: 100 };
    const points = clipEdgePointsToNodeBoundaries(
      [{ x: 0, y: 20 }, inner, { x: 20, y: 170 }],
      { shape: 'process', center: { x: 0, y: 0 }, width: 100, height: 40 },
      { shape: 'process', center: { x: 0, y: 200 }, width: 120, height: 60 },
    );

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 4, y: 20 });
    expect(points[1]).toEqual(inner);
    expect(points[2]).toEqual({ x: 6, y: 170 });
  });

  it('keeps converging routes on distinct target intersections when inner points differ', () => {
    const target = { shape: 'process' as const, center: { x: 0, y: 200 }, width: 160, height: 60 };
    const source = { shape: 'process' as const, center: { x: 0, y: 0 }, width: 100, height: 40 };
    const targetPoints = [-45, -15, 15, 45].map((x) => {
      const clipped = clipEdgePointsToNodeBoundaries(
        [{ x, y: 20 }, { x, y: 130 }, { x, y: 170 }],
        source,
        target,
      );
      return clipped[clipped.length - 1];
    });

    expect(new Set(targetPoints.map((point) => point.x.toFixed(4))).size).toBe(4);
    expect(targetPoints.every((point) => point.y === 170)).toBe(true);
  });

  it('generates rounded corners without changing terminal points', () => {
    const path = generateRoundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ]);

    expect(path).toMatch(/^M0,0L[\d.]+,0Q50,0 50,[\d.]+L50,50$/);
  });

  it('selects basis and linear curves and falls back to basis for unknown values', () => {
    const points = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }];
    const basis = generateImportedEdgePath(points, 'basis');
    const linear = generateImportedEdgePath(points, 'linear');
    const natural = generateImportedEdgePath(points, 'natural');
    const fallback = generateImportedEdgePath(points, 'unsupported');

    expect(linear).toBe('M0,0L50,50L100,0');
    expect(basis).toContain('C');
    expect(natural).toContain('C');
    expect(fallback).toBe(basis);
    expect(linear).not.toBe(basis);
  });

  it('uses a Dagre label coordinate, otherwise a path-length midpoint', () => {
    const explicit = getImportedEdgePath({
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      curve: 'linear',
      labelPosition: { x: 25, y: 10 },
    });
    expect(explicit).toEqual(['M0,0L100,0', 25, 10]);
    expect(getPathLengthMidpoint('M0,0L100,0L100,300')).toEqual({ x: 100, y: 100 });
  });

  it('does not crash on invalid points and falls back to the current handle-based path', () => {
    const params = {
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
    const fallback = getMermaidLikeOrthogonalEdgePath(params);

    expect(getImportedEdgePath(undefined)).toBeUndefined();
    expect(getImportedEdgePath({ points: [{ x: Number.NaN, y: 0 }] })).toBeUndefined();
    expect(getCanvasEdgePath({ ...params, data: { points: [{ x: Number.NaN, y: 0 }] } })).toEqual(fallback);
  });
});
