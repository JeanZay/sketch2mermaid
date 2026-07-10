import {
  curveBasis,
  curveLinear,
  curveNatural,
  line,
  type CurveFactory,
} from 'd3-shape';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';
import type {
  DiagramEdge,
  DiagramNode,
  EdgePoint,
  ImportedEdgeCurve,
  ImportedEdgeData,
  ImportedEdgeNodeSnapshot,
  NodeShape,
} from '../core/types';

const EPSILON = 1e-6;

interface NodeBoundaryGeometry {
  shape: NodeShape;
  center: EdgePoint;
  width: number;
  height: number;
}

type BoundaryKind = 'rectangle' | 'roundedRectangle' | 'ellipse' | 'diamond' | 'stadium' | 'cylinder';

const BOUNDARY_KIND_BY_SHAPE: Partial<Record<NodeShape, BoundaryKind>> = {
  rounded: 'roundedRectangle',
  stadium: 'stadium',
  event: 'ellipse',
  endEvent: 'ellipse',
  junction: 'ellipse',
  summary: 'ellipse',
  decision: 'diamond',
  collate: 'diamond',
  database: 'cylinder',
  diskStorage: 'cylinder',
};

function isFinitePoint(point: unknown): point is EdgePoint {
  if (!point || typeof point !== 'object') return false;
  const candidate = point as Partial<EdgePoint>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
}

function samePoint(a: EdgePoint, b: EdgePoint): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function dedupeConsecutivePoints(points: EdgePoint[]): EdgePoint[] {
  const result: EdgePoint[] = [];
  for (const point of points) {
    if (result.length === 0 || !samePoint(result[result.length - 1], point)) {
      result.push(point);
    }
  }
  return result;
}

function intersectRectangle(node: NodeBoundaryGeometry, toward: EdgePoint): EdgePoint {
  const dx = toward.x - node.center.x;
  const dy = toward.y - node.center.y;
  const halfWidth = Math.max(node.width / 2, EPSILON);
  const halfHeight = Math.max(node.height / 2, EPSILON);

  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) {
    return { x: node.center.x, y: node.center.y - halfHeight };
  }

  const scale = Math.min(
    Math.abs(dx) <= EPSILON ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    Math.abs(dy) <= EPSILON ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
  );
  return { x: node.center.x + dx * scale, y: node.center.y + dy * scale };
}

function intersectEllipse(node: NodeBoundaryGeometry, toward: EdgePoint): EdgePoint {
  const dx = toward.x - node.center.x;
  const dy = toward.y - node.center.y;
  const rx = Math.max(node.width / 2, EPSILON);
  const ry = Math.max(node.height / 2, EPSILON);
  const denominator = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  if (denominator <= EPSILON) return { x: node.center.x, y: node.center.y - ry };
  return { x: node.center.x + dx / denominator, y: node.center.y + dy / denominator };
}

function intersectDiamond(node: NodeBoundaryGeometry, toward: EdgePoint): EdgePoint {
  const dx = toward.x - node.center.x;
  const dy = toward.y - node.center.y;
  const halfWidth = Math.max(node.width / 2, EPSILON);
  const halfHeight = Math.max(node.height / 2, EPSILON);
  const denominator = Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight;
  if (denominator <= EPSILON) return { x: node.center.x, y: node.center.y - halfHeight };
  return { x: node.center.x + dx / denominator, y: node.center.y + dy / denominator };
}

function isInsideRoundedRectangle(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): boolean {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax > halfWidth || ay > halfHeight) return false;
  if (ax <= halfWidth - radius || ay <= halfHeight - radius) return true;
  const cornerX = ax - (halfWidth - radius);
  const cornerY = ay - (halfHeight - radius);
  return cornerX * cornerX + cornerY * cornerY <= radius * radius + EPSILON;
}

function intersectRoundedRectangle(
  node: NodeBoundaryGeometry,
  toward: EdgePoint,
  radius: number,
): EdgePoint {
  const dx = toward.x - node.center.x;
  const dy = toward.y - node.center.y;
  const halfWidth = Math.max(node.width / 2, EPSILON);
  const halfHeight = Math.max(node.height / 2, EPSILON);
  const effectiveRadius = Math.max(0, Math.min(radius, halfWidth, halfHeight));
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) {
    return { x: node.center.x, y: node.center.y - halfHeight };
  }

  let low = 0;
  let high = Math.max(
    Math.abs(dx) <= EPSILON ? 0 : halfWidth / Math.abs(dx),
    Math.abs(dy) <= EPSILON ? 0 : halfHeight / Math.abs(dy),
    1,
  );
  while (isInsideRoundedRectangle(dx * high, dy * high, halfWidth, halfHeight, effectiveRadius)) {
    high *= 2;
  }
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (isInsideRoundedRectangle(dx * mid, dy * mid, halfWidth, halfHeight, effectiveRadius)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return { x: node.center.x + dx * low, y: node.center.y + dy * low };
}

/** Returns the boundary point on a node in the direction of `toward`. */
export function intersectNodeBoundary(node: NodeBoundaryGeometry, toward: EdgePoint): EdgePoint {
  const kind = BOUNDARY_KIND_BY_SHAPE[node.shape] ?? 'rectangle';
  switch (kind) {
    case 'ellipse':
      return intersectEllipse(node, toward);
    case 'diamond':
      return intersectDiamond(node, toward);
    case 'roundedRectangle':
      return intersectRoundedRectangle(node, toward, 8);
    case 'stadium':
      return intersectRoundedRectangle(node, toward, node.height / 2);
    case 'cylinder':
      // Cylinders have shallow elliptical caps; a rounded box is a close
      // boundary model and keeps the strategy independently replaceable.
      return intersectRoundedRectangle(node, toward, Math.min(12, node.height / 2));
    case 'rectangle':
    default:
      return intersectRectangle(node, toward);
  }
}

/**
 * Mirrors Mermaid's edge contract: keep Dagre's inner routing points and
 * replace only the terminal rectangle intersections with shape intersections.
 */
export function clipEdgePointsToNodeBoundaries(
  points: readonly EdgePoint[],
  sourceNode: NodeBoundaryGeometry,
  targetNode: NodeBoundaryGeometry,
): EdgePoint[] {
  const validPoints = points.filter(isFinitePoint).map((point) => ({ x: point.x, y: point.y }));
  if (validPoints.length < 2) return [];

  const sourceToward = validPoints.slice(1).find((point) => !samePoint(point, sourceNode.center))
    ?? targetNode.center;
  const targetToward = [...validPoints.slice(0, -1)].reverse().find((point) => !samePoint(point, targetNode.center))
    ?? sourceNode.center;

  const clipped = [
    intersectNodeBoundary(sourceNode, sourceToward),
    ...validPoints.slice(1, -1),
    intersectNodeBoundary(targetNode, targetToward),
  ];
  const deduped = dedupeConsecutivePoints(clipped);
  return deduped.length >= 2 ? deduped : [];
}

export function createImportedEdgeNodeSnapshot(
  node: DiagramNode,
  position: EdgePoint = node.position,
): ImportedEdgeNodeSnapshot {
  const defaults = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
  return {
    nodeId: node.id,
    shape: node.shape,
    x: position.x,
    y: position.y,
    width: node.width ?? defaults.width,
    height: node.height ?? defaults.height,
  };
}

export function snapshotToBoundaryGeometry(snapshot: ImportedEdgeNodeSnapshot): NodeBoundaryGeometry {
  return {
    shape: snapshot.shape,
    center: { x: snapshot.x + snapshot.width / 2, y: snapshot.y + snapshot.height / 2 },
    width: snapshot.width,
    height: snapshot.height,
  };
}

export function createImportedEdgeData(
  dagrePoints: readonly EdgePoint[] | undefined,
  sourceNode: ImportedEdgeNodeSnapshot,
  targetNode: ImportedEdgeNodeSnapshot,
  labelPosition?: EdgePoint,
  curve: ImportedEdgeCurve = 'basis',
): ImportedEdgeData | undefined {
  if (!dagrePoints) return undefined;
  const points = clipEdgePointsToNodeBoundaries(
    dagrePoints,
    snapshotToBoundaryGeometry(sourceNode),
    snapshotToBoundaryGeometry(targetNode),
  );
  if (points.length < 2) return undefined;
  return {
    points,
    curve,
    ...(isFinitePoint(labelPosition) ? { labelPosition: { ...labelPosition } } : {}),
    sourceNode,
    targetNode,
  };
}

export function generateRoundedPath(points: readonly EdgePoint[], radius = 5): string {
  if (points.length < 2) return '';
  let path = '';
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    const next = points[i + 1];
    if (i === 0) {
      path += `M${current.x},${current.y}`;
      continue;
    }
    if (i === points.length - 1) {
      path += `L${current.x},${current.y}`;
      continue;
    }

    const dx1 = current.x - previous.x;
    const dy1 = current.y - previous.y;
    const dx2 = next.x - current.x;
    const dy2 = next.y - current.y;
    const length1 = Math.hypot(dx1, dy1);
    const length2 = Math.hypot(dx2, dy2);
    if (length1 < EPSILON || length2 < EPSILON) {
      path += `L${current.x},${current.y}`;
      continue;
    }

    const nx1 = dx1 / length1;
    const ny1 = dy1 / length1;
    const nx2 = dx2 / length2;
    const ny2 = dy2 / length2;
    const angle = Math.acos(Math.max(-1, Math.min(1, nx1 * nx2 + ny1 * ny2)));
    if (angle < EPSILON || Math.abs(Math.PI - angle) < EPSILON) {
      path += `L${current.x},${current.y}`;
      continue;
    }

    const cutLength = Math.min(radius / Math.sin(angle / 2), length1 / 2, length2 / 2);
    const start = { x: current.x - nx1 * cutLength, y: current.y - ny1 * cutLength };
    const end = { x: current.x + nx2 * cutLength, y: current.y + ny2 * cutLength };
    path += `L${start.x},${start.y}Q${current.x},${current.y} ${end.x},${end.y}`;
  }
  return path;
}

export function resolveImportedEdgeCurve(curve: unknown): ImportedEdgeCurve {
  return curve === 'linear' || curve === 'natural' || curve === 'rounded' || curve === 'basis'
    ? curve
    : 'basis';
}

const CURVE_FACTORIES: Record<Exclude<ImportedEdgeCurve, 'rounded'>, CurveFactory> = {
  basis: curveBasis,
  linear: curveLinear,
  natural: curveNatural,
};

export function generateImportedEdgePath(points: readonly EdgePoint[], curve: unknown = 'basis'): string {
  const validPoints = points.filter(isFinitePoint);
  if (validPoints.length < 2) return '';
  const resolvedCurve = resolveImportedEdgeCurve(curve);
  if (resolvedCurve === 'rounded') return generateRoundedPath(validPoints, 5);
  const generator = line<EdgePoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(CURVE_FACTORIES[resolvedCurve]);
  return generator(validPoints) ?? '';
}

function cubicPoint(p0: EdgePoint, p1: EdgePoint, p2: EdgePoint, p3: EdgePoint, t: number): EdgePoint {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function quadraticPoint(p0: EdgePoint, p1: EdgePoint, p2: EdgePoint, t: number): EdgePoint {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function sampleSvgPath(path: string): EdgePoint[] {
  const tokens = path.match(/[MLCQ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const samples: EdgePoint[] = [];
  let index = 0;
  let command = '';
  let current: EdgePoint = { x: 0, y: 0 };
  const number = () => Number(tokens[index++]);
  const takePoint = (): EdgePoint => ({ x: number(), y: number() });

  while (index < tokens.length) {
    if (/^[MLCQ]$/i.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (!command) return [];
    if (command === 'M' || command === 'L') {
      const point = takePoint();
      if (!isFinitePoint(point)) return [];
      samples.push(point);
      current = point;
      if (command === 'M') command = 'L';
    } else if (command === 'Q') {
      const control = takePoint();
      const end = takePoint();
      if (!isFinitePoint(control) || !isFinitePoint(end)) return [];
      for (let step = 1; step <= 20; step++) samples.push(quadraticPoint(current, control, end, step / 20));
      current = end;
    } else if (command === 'C') {
      const control1 = takePoint();
      const control2 = takePoint();
      const end = takePoint();
      if (!isFinitePoint(control1) || !isFinitePoint(control2) || !isFinitePoint(end)) return [];
      for (let step = 1; step <= 20; step++) samples.push(cubicPoint(current, control1, control2, end, step / 20));
      current = end;
    }
  }
  return samples;
}

/** Approximate SVG path-length midpoint for label placement without DOM APIs. */
export function getPathLengthMidpoint(path: string): EdgePoint | undefined {
  const samples = sampleSvgPath(path);
  if (samples.length < 2) return undefined;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const length = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= EPSILON) return samples[0];
  const target = total / 2;
  let traversed = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (traversed + lengths[i] >= target) {
      const ratio = lengths[i] <= EPSILON ? 0 : (target - traversed) / lengths[i];
      return {
        x: samples[i].x + (samples[i + 1].x - samples[i].x) * ratio,
        y: samples[i].y + (samples[i + 1].y - samples[i].y) * ratio,
      };
    }
    traversed += lengths[i];
  }
  return samples[samples.length - 1];
}

export function getImportedEdgePath(data: unknown): [string, number, number] | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const importedData = data as Partial<ImportedEdgeData>;
  if (!Array.isArray(importedData.points)) return undefined;
  const path = generateImportedEdgePath(importedData.points, importedData.curve);
  if (!path) return undefined;
  const midpoint = isFinitePoint(importedData.labelPosition)
    ? importedData.labelPosition
    : getPathLengthMidpoint(path);
  if (!midpoint) return undefined;
  return [path, midpoint.x, midpoint.y];
}

function snapshotMatchesNode(snapshot: ImportedEdgeNodeSnapshot, node: DiagramNode): boolean {
  const current = createImportedEdgeNodeSnapshot(node);
  return snapshot.nodeId === current.nodeId
    && snapshot.shape === current.shape
    && snapshot.x === current.x
    && snapshot.y === current.y
    && snapshot.width === current.width
    && snapshot.height === current.height;
}

export function isImportedEdgeRouteCurrent(edge: DiagramEdge, nodes: readonly DiagramNode[]): boolean {
  if (!getImportedEdgePath(edge.data)) return false;
  if (!edge.data?.sourceNode || !edge.data.targetNode) return true;
  if (edge.from.kind !== 'connected' || edge.to.kind !== 'connected') return false;
  if (edge.data.sourceNode.nodeId !== edge.from.nodeId || edge.data.targetNode.nodeId !== edge.to.nodeId) return false;
  const source = nodes.find((node) => node.id === edge.from.nodeId);
  const target = nodes.find((node) => node.id === edge.to.nodeId);
  return !!source && !!target
    && snapshotMatchesNode(edge.data.sourceNode, source)
    && snapshotMatchesNode(edge.data.targetNode, target);
}

function warpPoint(
  point: EdgePoint,
  oldSource: EdgePoint,
  oldTarget: EdgePoint,
  newSource: EdgePoint,
  newTarget: EdgePoint,
): EdgePoint {
  const dx = oldTarget.x - oldSource.x;
  const dy = oldTarget.y - oldSource.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= EPSILON
    ? 0.5
    : Math.max(0, Math.min(1, ((point.x - oldSource.x) * dx + (point.y - oldSource.y) * dy) / lengthSquared));
  return {
    x: point.x + (newSource.x - oldSource.x) * (1 - t) + (newTarget.x - oldTarget.x) * t,
    y: point.y + (newSource.y - oldSource.y) * (1 - t) + (newTarget.y - oldTarget.y) * t,
  };
}

/** Re-aligns a route when the optional Mermaid SVG sizing oracle changes node bounds. */
export function rebaseImportedEdgeData(
  data: ImportedEdgeData | undefined,
  source: DiagramNode,
  target: DiagramNode,
): ImportedEdgeData | undefined {
  if (!data?.sourceNode || !data.targetNode || !Array.isArray(data.points)) return data;
  const sourceNode = createImportedEdgeNodeSnapshot(source);
  const targetNode = createImportedEdgeNodeSnapshot(target);
  const oldSource = snapshotToBoundaryGeometry(data.sourceNode).center;
  const oldTarget = snapshotToBoundaryGeometry(data.targetNode).center;
  const newSource = snapshotToBoundaryGeometry(sourceNode).center;
  const newTarget = snapshotToBoundaryGeometry(targetNode).center;
  const warped = data.points.map((point) => warpPoint(point, oldSource, oldTarget, newSource, newTarget));
  const points = clipEdgePointsToNodeBoundaries(
    warped,
    snapshotToBoundaryGeometry(sourceNode),
    snapshotToBoundaryGeometry(targetNode),
  );
  if (points.length < 2) return undefined;
  const labelPosition = data.labelPosition
    ? warpPoint(data.labelPosition, oldSource, oldTarget, newSource, newTarget)
    : undefined;
  return { ...data, points, labelPosition, sourceNode, targetNode };
}
