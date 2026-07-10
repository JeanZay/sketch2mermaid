import { getBezierPath, Position } from '@xyflow/react';
import { USE_MERMAID_LIKE_EDGE_RENDERING, MERMAID_LIKE_MIN_EDGE_BEND } from '../core/config';
import { getImportedEdgePath } from './importedEdgeRouting';

interface GetOrthogonalPathParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position | string;
  targetPosition?: Position | string;
}

interface GetCanvasEdgePathParams extends GetOrthogonalPathParams {
  data?: unknown;
}

interface Point {
  x: number;
  y: number;
}

function normalizePosition(pos?: Position | string): Position {
  if (!pos) return Position.Bottom;
  if (typeof pos === 'string') {
    switch (pos.toLowerCase()) {
      case 'left': return Position.Left;
      case 'right': return Position.Right;
      case 'top': return Position.Top;
      case 'bottom': return Position.Bottom;
    }
  }
  return pos as Position;
}

/**
 * Generates an orthogonal path between source and target points, favoring departure
 * and arrival directions based on their handle positions.
 *
 * Returns a tuple [pathString, labelX, labelY] compatible with React Flow's custom edge path contract.
 */
export function getMermaidLikeOrthogonalEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: GetOrthogonalPathParams): [string, number, number] {
  const sx = sourceX;
  const sy = sourceY;
  const tx = targetX;
  const ty = targetY;

  const sPos = normalizePosition(sourcePosition);
  const tPos = normalizePosition(targetPosition);

  const minExt = USE_MERMAID_LIKE_EDGE_RENDERING ? MERMAID_LIKE_MIN_EDGE_BEND : 20; // minimal extension length before turning

  let points: Point[] = [];

  const isHorizSource = sPos === Position.Left || sPos === Position.Right;
  const isHorizTarget = tPos === Position.Left || tPos === Position.Right;

  if (isHorizSource && isHorizTarget) {
    // Case 1: Horizontal -> Horizontal
    if (sPos === Position.Right && tPos === Position.Left) {
      if (tx >= sx + 2 * minExt) {
        const midX = (sx + tx) / 2;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = (sy + ty) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx + minExt, y: sy },
          { x: sx + minExt, y: midY },
          { x: tx - minExt, y: midY },
          { x: tx - minExt, y: ty },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Left && tPos === Position.Right) {
      if (tx <= sx - 2 * minExt) {
        const midX = (sx + tx) / 2;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = (sy + ty) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx - minExt, y: sy },
          { x: sx - minExt, y: midY },
          { x: tx + minExt, y: midY },
          { x: tx + minExt, y: ty },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Right && tPos === Position.Right) {
      const maxX = Math.max(sx, tx) + minExt;
      points = [
        { x: sx, y: sy },
        { x: maxX, y: sy },
        { x: maxX, y: ty },
        { x: tx, y: ty },
      ];
    } else if (sPos === Position.Left && tPos === Position.Left) {
      const minX = Math.min(sx, tx) - minExt;
      points = [
        { x: sx, y: sy },
        { x: minX, y: sy },
        { x: minX, y: ty },
        { x: tx, y: ty },
      ];
    }
  } else if (!isHorizSource && !isHorizTarget) {
    // Case 2: Vertical -> Vertical
    if (sPos === Position.Bottom && tPos === Position.Top) {
      if (ty >= sy + 2 * minExt) {
        const midY = (sy + ty) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      } else {
        const midX = (sx + tx) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx, y: sy + minExt },
          { x: midX, y: sy + minExt },
          { x: midX, y: ty - minExt },
          { x: tx, y: ty - minExt },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Top && tPos === Position.Bottom) {
      if (ty <= sy - 2 * minExt) {
        const midY = (sy + ty) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      } else {
        const midX = (sx + tx) / 2;
        points = [
          { x: sx, y: sy },
          { x: sx, y: sy - minExt },
          { x: midX, y: sy - minExt },
          { x: midX, y: ty + minExt },
          { x: tx, y: ty + minExt },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Bottom && tPos === Position.Bottom) {
      const maxY = Math.max(sy, ty) + minExt;
      points = [
        { x: sx, y: sy },
        { x: sx, y: maxY },
        { x: tx, y: maxY },
        { x: tx, y: ty },
      ];
    } else if (sPos === Position.Top && tPos === Position.Top) {
      const minY = Math.min(sy, ty) - minExt;
      points = [
        { x: sx, y: sy },
        { x: sx, y: minY },
        { x: tx, y: minY },
        { x: tx, y: ty },
      ];
    }
  } else if (isHorizSource && !isHorizTarget) {
    // Case 3: Horizontal -> Vertical
    if (sPos === Position.Right && tPos === Position.Top) {
      if (tx >= sx + minExt && ty >= sy) {
        points = [
          { x: sx, y: sy },
          { x: tx, y: sy },
          { x: tx, y: ty },
        ];
      } else {
        const midX = tx >= sx + minExt ? tx : sx + minExt;
        const midY = ty - minExt;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Right && tPos === Position.Bottom) {
      if (tx >= sx + minExt && ty <= sy) {
        points = [
          { x: sx, y: sy },
          { x: tx, y: sy },
          { x: tx, y: ty },
        ];
      } else {
        const midX = tx >= sx + minExt ? tx : sx + minExt;
        const midY = ty + minExt;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Left && tPos === Position.Top) {
      if (tx <= sx - minExt && ty >= sy) {
        points = [
          { x: sx, y: sy },
          { x: tx, y: sy },
          { x: tx, y: ty },
        ];
      } else {
        const midX = tx <= sx - minExt ? tx : sx - minExt;
        const midY = ty - minExt;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Left && tPos === Position.Bottom) {
      if (tx <= sx - minExt && ty <= sy) {
        points = [
          { x: sx, y: sy },
          { x: tx, y: sy },
          { x: tx, y: ty },
        ];
      } else {
        const midX = tx <= sx - minExt ? tx : sx - minExt;
        const midY = ty + minExt;
        points = [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: midY },
          { x: tx, y: midY },
          { x: tx, y: ty },
        ];
      }
    }
  } else {
    // Case 4: Vertical -> Horizontal
    if (sPos === Position.Bottom && tPos === Position.Right) {
      if (ty >= sy + minExt && tx <= sx) {
        points = [
          { x: sx, y: sy },
          { x: sx, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = ty >= sy + minExt ? ty : sy + minExt;
        const midX = tx + minExt;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: midX, y: midY },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Bottom && tPos === Position.Left) {
      if (ty >= sy + minExt && tx >= sx) {
        points = [
          { x: sx, y: sy },
          { x: sx, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = ty >= sy + minExt ? ty : sy + minExt;
        const midX = tx - minExt;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: midX, y: midY },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Top && tPos === Position.Right) {
      if (ty <= sy - minExt && tx <= sx) {
        points = [
          { x: sx, y: sy },
          { x: sx, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = ty <= sy - minExt ? ty : sy - minExt;
        const midX = tx + minExt;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: midX, y: midY },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      }
    } else if (sPos === Position.Top && tPos === Position.Left) {
      if (ty <= sy - minExt && tx >= sx) {
        points = [
          { x: sx, y: sy },
          { x: sx, y: ty },
          { x: tx, y: ty },
        ];
      } else {
        const midY = ty <= sy - minExt ? ty : sy - minExt;
        const midX = tx - minExt;
        points = [
          { x: sx, y: sy },
          { x: sx, y: midY },
          { x: midX, y: midY },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ];
      }
    }
  }

  // Fallback to direct line if points array is empty
  if (points.length === 0) {
    points = [
      { x: sx, y: sy },
      { x: tx, y: ty },
    ];
  }

  // Remove consecutive duplicates
  const uniquePoints: Point[] = [];
  for (const pt of points) {
    if (uniquePoints.length === 0) {
      uniquePoints.push(pt);
    } else {
      const last = uniquePoints[uniquePoints.length - 1];
      if (last.x !== pt.x || last.y !== pt.y) {
        uniquePoints.push(pt);
      }
    }
  }

  // Generate SVG path string using only M and L commands
  const pathString = `M ${uniquePoints[0].x} ${uniquePoints[0].y} ` +
    uniquePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  // Midpoint walking logic
  const segments: { p1: Point; p2: Point; length: number }[] = [];
  let totalLength = 0;
  for (let i = 0; i < uniquePoints.length - 1; i++) {
    const p1 = uniquePoints[i];
    const p2 = uniquePoints[i + 1];
    const len = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
    segments.push({ p1, p2, length: len });
    totalLength += len;
  }

  const targetLen = totalLength / 2;
  let accumulated = 0;
  let geomX = (sx + tx) / 2;
  let geomY = (sy + ty) / 2;

  for (const seg of segments) {
    if (accumulated + seg.length >= targetLen) {
      const remaining = targetLen - accumulated;
      const ratio = seg.length > 0 ? remaining / seg.length : 0;
      geomX = seg.p1.x + ratio * (seg.p2.x - seg.p1.x);
      geomY = seg.p1.y + ratio * (seg.p2.y - seg.p1.y);
      break;
    }
    accumulated += seg.length;
  }

  let labelX = geomX;
  let labelY = geomY;

  // Corner safeguard
  const minCornerDist = 20;
  const corners: Point[] = [];
  for (let i = 1; i < uniquePoints.length - 1; i++) {
    const prev = uniquePoints[i - 1];
    const curr = uniquePoints[i];
    const next = uniquePoints[i + 1];
    const isCollinear = (prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y);
    if (!isCollinear) {
      corners.push(curr);
    }
  }

  let tooClose = false;
  for (const corner of corners) {
    const dist = Math.hypot(geomX - corner.x, geomY - corner.y);
    if (dist < minCornerDist) {
      tooClose = true;
      break;
    }
  }

  if (tooClose && segments.length > 0) {
    // Find the longest segment
    let longestSeg = segments[0];
    for (const seg of segments) {
      if (seg.length > longestSeg.length) {
        longestSeg = seg;
      }
    }
    // Place label at the midpoint of the longest segment
    labelX = (longestSeg.p1.x + longestSeg.p2.x) / 2;
    labelY = (longestSeg.p1.y + longestSeg.p2.y) / 2;
  }

  return [pathString, labelX, labelY];
}

/**
 * Imported Dagre points take precedence over handle coordinates. Missing or
 * malformed route data deliberately falls back to the existing interactive
 * React Flow path behavior.
 */
export function getCanvasEdgePath({ data, ...params }: GetCanvasEdgePathParams): [string, number, number] {
  const importedPath = getImportedEdgePath(data);
  if (importedPath) return importedPath;

  if (USE_MERMAID_LIKE_EDGE_RENDERING) {
    return getMermaidLikeOrthogonalEdgePath(params);
  }
  return getBezierPath({
    ...params,
    sourcePosition: normalizePosition(params.sourcePosition),
    targetPosition: normalizePosition(params.targetPosition),
  });
}
