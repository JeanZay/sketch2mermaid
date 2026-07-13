import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { getCanvasEdgePath, getMermaidLikeOrthogonalEdgePath } from './edgeRouting';
import {
  clipEdgePointsToNodeBoundaries,
  createCapturedImportedEdgeData,
  generateImportedEdgePath,
  generateRoundedPath,
  getImportedEdgePath,
  getPathLengthMidpoint,
  isImportedEdgeRouteCurrent,
} from './importedEdgeRouting';
import type { DiagramEdge, DiagramNode } from '../core/types';

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

  it('keeps Mermaid-clipped points exact and refreshes their runtime snapshots', () => {
    const source: DiagramNode = {
      id: 'source',
      label: 'Source',
      shape: 'cloud',
      position: { x: 10, y: 20 },
      width: 120,
      height: 60,
    };
    const target: DiagramNode = {
      id: 'target',
      label: 'Target',
      shape: 'comment',
      position: { x: 240, y: 180 },
      width: 140,
      height: 70,
    };
    const captured = createCapturedImportedEdgeData(
      [{ x: 73.25, y: 80.5 }, { x: 73.25, y: 80.5 }, { x: 300.75, y: 180.25 }],
      source,
      target,
      {
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        curve: 'natural',
        labelPosition: { x: 150, y: 120 },
      },
    );

    expect(captured?.points).toEqual([
      { x: 73.25, y: 80.5 },
      { x: 300.75, y: 180.25 },
    ]);
    expect(captured?.curve).toBe('natural');
    expect(captured?.labelPosition).toEqual({ x: 187, y: 130.375 });
    expect(getImportedEdgePath(captured)).toEqual([
      'M73.25,80.5L300.75,180.25',
      187,
      130.375,
    ]);
    expect(captured?.sourceNode).toEqual({
      nodeId: 'source',
      shape: 'cloud',
      x: 10,
      y: 20,
      width: 120,
      height: 60,
    });
    expect(captured?.targetNode).toEqual({
      nodeId: 'target',
      shape: 'comment',
      x: 240,
      y: 180,
      width: 140,
      height: 70,
    });

    const edge: DiagramEdge = {
      id: 'captured-edge',
      from: { kind: 'connected', nodeId: 'source', handleId: 'b-source' },
      to: { kind: 'connected', nodeId: 'target', handleId: 't-target' },
      connectionStatus: 'connected',
      exportMode: 'mermaid',
      label: '',
      style: 'solid',
      data: captured,
    };
    expect(isImportedEdgeRouteCurrent(edge, [source, target])).toBe(true);
    expect(isImportedEdgeRouteCurrent(edge, [
      { ...source, position: { x: source.position.x + 1, y: source.position.y } },
      target,
    ])).toBe(false);
    expect(createCapturedImportedEdgeData(
      [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }],
      source,
      target,
    )).toBeUndefined();
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
