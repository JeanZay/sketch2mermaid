import { describe, test, expect } from 'vitest';
import type { DiagramNode } from '../core/types';
import { findNearestHandle, getNodeHandlePositions } from './edgeSnapping';

describe('Edge Snapping Utilities', () => {
  const mockNodes: DiagramNode[] = [
    {
      id: 'n1',
      label: 'Node 1',
      shape: 'process',
      position: { x: 100, y: 100 },
      width: 100,
      height: 40,
    },
    {
      id: 'n2',
      label: 'Node 2',
      shape: 'process',
      position: { x: 300, y: 300 },
      width: 100,
      height: 40,
    },
  ];

  test('getNodeHandlePositions computes all 8 handles correctly', () => {
    const handles = getNodeHandlePositions(mockNodes[0]);
    expect(handles).toHaveLength(8);

    // Top handles (target & source) should be at center top: (150, 100)
    const topTarget = handles.find((h) => h.id === 't-target')!;
    expect(topTarget.x).toBe(150);
    expect(topTarget.y).toBe(100);

    const topSource = handles.find((h) => h.id === 't-source')!;
    expect(topSource.x).toBe(150);
    expect(topSource.y).toBe(100);

    // Right handles should be at middle right: (200, 120)
    const rightTarget = handles.find((h) => h.id === 'r-target')!;
    expect(rightTarget.x).toBe(200);
    expect(rightTarget.y).toBe(120);
  });

  test('findNearestHandle snaps to nearest handle within threshold', () => {
    // Point close to n1's top handle (150, 100) - distance is 10px
    const pointNear = { x: 150, y: 90 };
    const target = findNearestHandle(pointNear, mockNodes);

    expect(target).not.toBeNull();
    expect(target!.nodeId).toBe('n1');
    expect(target!.handleId).toBe('t-target'); // or t-source, distance is same, both are valid target shapes
    expect(target!.distance).toBe(10);
  });

  test('findNearestHandle returns closest target even when multiple handles match', () => {
    // Point exactly at (150, 100)
    const target = findNearestHandle({ x: 150, y: 100 }, mockNodes);
    expect(target).not.toBeNull();
    expect(target!.distance).toBe(0);
    expect(target!.nodeId).toBe('n1');
  });

  test('findNearestHandle calculates correct distance', () => {
    const target = findNearestHandle({ x: 150, y: 80 }, mockNodes); // 20px straight up
    expect(target!.distance).toBe(20);
  });
});
