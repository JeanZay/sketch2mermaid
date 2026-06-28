import type { DiagramNode, CanonicalDiagram } from '../core/types';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';

export interface HandlePosition {
  id: string;
  x: number;
  y: number;
}

export interface SnapTarget {
  nodeId: string;
  handleId: string;
  x: number;
  y: number;
  distance: number;
}

/**
 * Computes the exact visual positions of all 8 handles for a given node.
 */
export function getNodeHandlePositions(node: DiagramNode): HandlePosition[] {
  const defaults = NODE_SIZE_DEFAULTS[node.shape] || NODE_SIZE_DEFAULTS.process;
  const width = node.width ?? defaults.width;
  const height = node.height ?? defaults.height;

  const x = node.position.x;
  const y = node.position.y;

  return [
    { id: 't-target', x: x + width / 2, y: y },
    { id: 't-source', x: x + width / 2, y: y },
    { id: 'b-target', x: x + width / 2, y: y + height },
    { id: 'b-source', x: x + width / 2, y: y + height },
    { id: 'l-target', x: x, y: y + height / 2 },
    { id: 'l-source', x: x, y: y + height / 2 },
    { id: 'r-target', x: x + width, y: y + height / 2 },
    { id: 'r-source', x: x + width, y: y + height / 2 },
  ];
}

/**
 * Finds the nearest node handle to a given point within all nodes.
 */
export function findNearestHandle(
  point: { x: number; y: number },
  nodes: DiagramNode[]
): SnapTarget | null {
  let closest: SnapTarget | null = null;
  let minDistance = Infinity;

  for (const node of nodes) {
    const handles = getNodeHandlePositions(node);
    for (const h of handles) {
      const dx = point.x - h.x;
      const dy = point.y - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          nodeId: node.id,
          handleId: h.id,
          x: h.x,
          y: h.y,
          distance: dist,
        };
      }
    }
  }

  return closest;
}

/**
 * Computes the coordinates of the endpoint of a given edge, checking virtual anchors first.
 */
export function getEdgeEndpointPosition(
  edgeId: string,
  endpoint: 'from' | 'to',
  diagram: CanonicalDiagram,
  virtualAnchors: Record<string, { sourceX: number; sourceY: number; targetX: number; targetY: number } | undefined> = {}
): { x: number; y: number } {
  const anchor = virtualAnchors[edgeId];
  if (anchor) {
    return endpoint === 'from'
      ? { x: anchor.sourceX, y: anchor.sourceY }
      : { x: anchor.targetX, y: anchor.targetY };
  }

  const edge = diagram.edges.find((e) => e.id === edgeId);
  if (!edge) return { x: 0, y: 0 };

  const ep = endpoint === 'from' ? edge.from : edge.to;
  if (ep.kind !== 'connected') {
    return ep.point;
  }

  const node = diagram.nodes.find((n) => n.id === ep.nodeId);
  if (!node) return { x: 0, y: 0 };

  const defaults = NODE_SIZE_DEFAULTS[node.shape] || NODE_SIZE_DEFAULTS.process;
  const width = node.width ?? defaults.width;
  const height = node.height ?? defaults.height;
  const handleId = ep.handleId;

  let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  if (handleId) {
    if (handleId.startsWith('t-')) side = 'top';
    else if (handleId.startsWith('b-')) side = 'bottom';
    else if (handleId.startsWith('l-')) side = 'left';
    else if (handleId.startsWith('r-')) side = 'right';
  }

  switch (side) {
    case 'top':
      return { x: node.position.x + width / 2, y: node.position.y };
    case 'bottom':
      return { x: node.position.x + width / 2, y: node.position.y + height };
    case 'left':
      return { x: node.position.x, y: node.position.y + height / 2 };
    case 'right':
      return { x: node.position.x + width, y: node.position.y + height / 2 };
  }
}
