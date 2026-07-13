import type {
  CanonicalDiagram,
  DiagramDirection,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  EdgePoint,
  ImportedEdgeCurve,
} from '../types';
import { isExportableEdge } from '../types';
import { deepClone } from '../../utils/clone';
import { NODE_SIZE_DEFAULTS } from '../nodeSizeConfig';
import {
  MERMAID_LIKE_CLUSTER_PADDING,
  MERMAID_LIKE_GROUP_TITLE_HEIGHT,
} from '../config';
import { sortById, toMermaid } from '../mermaid';
import {
  layoutImportedDiagram,
  selectHandlesDirectionAware,
} from './mermaidLayout';
import {
  refineMermaidLayoutWithSvg,
  type LayoutOracleDiagnostics,
} from '../mermaidImport';

export const AUTO_LAYOUT_COLLISION_GAP = 24;
const DETACHED_EDGE_PADDING = 8;
const MAX_COLLISION_RINGS = 200;

export interface AutoLayoutResult {
  diagram: CanonicalDiagram;
  mode: 'mermaid-svg' | 'dagre-fallback';
  warnings: string[];
  diagnostics?: LayoutOracleDiagnostics;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Anchor {
  id: string;
  oldRect: Rect;
  newRect: Rect;
}

function nodeRect(node: DiagramNode): Rect {
  const defaults = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? defaults.width,
    height: node.height ?? defaults.height,
  };
}

function groupRect(group: DiagramGroup): Rect {
  return {
    x: group.position.x,
    y: group.position.y,
    width: group.width,
    height: group.height,
  };
}

function rectCenter(rect: Rect): EdgePoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function pointInRect(point: EdgePoint, rect: Rect): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function distanceSquared(a: EdgePoint, b: EdgePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function collides(candidate: Rect, obstacles: Rect[]): boolean {
  return obstacles.some((obstacle) => !(
    candidate.x + candidate.width + AUTO_LAYOUT_COLLISION_GAP <= obstacle.x
    || obstacle.x + obstacle.width + AUTO_LAYOUT_COLLISION_GAP <= candidate.x
    || candidate.y + candidate.height + AUTO_LAYOUT_COLLISION_GAP <= obstacle.y
    || obstacle.y + obstacle.height + AUTO_LAYOUT_COLLISION_GAP <= candidate.y
  ));
}

function ringOffsets(ring: number): EdgePoint[] {
  const offsets: EdgePoint[] = [];
  for (let x = -ring; x <= ring; x++) offsets.push({ x, y: -ring });
  for (let y = -ring + 1; y <= ring; y++) offsets.push({ x: ring, y });
  for (let x = ring - 1; x >= -ring; x--) offsets.push({ x, y: ring });
  for (let y = ring - 1; y > -ring; y--) offsets.push({ x: -ring, y });
  return offsets;
}

function findFreePosition(preferred: EdgePoint, size: { width: number; height: number }, obstacles: Rect[]): EdgePoint {
  const rounded = { x: Math.round(preferred.x), y: Math.round(preferred.y) };
  if (!collides({ ...rounded, ...size }, obstacles)) return rounded;

  for (let ring = 1; ring <= MAX_COLLISION_RINGS; ring++) {
    for (const offset of ringOffsets(ring)) {
      const candidate = {
        x: rounded.x + offset.x * AUTO_LAYOUT_COLLISION_GAP,
        y: rounded.y + offset.y * AUTO_LAYOUT_COLLISION_GAP,
      };
      if (!collides({ ...candidate, ...size }, obstacles)) return candidate;
    }
  }

  return rounded;
}

function diagramBounds(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function stagingPosition(direction: DiagramDirection, bounds: Rect | null): EdgePoint {
  if (!bounds) return { x: 8, y: 8 };
  if (direction === 'TD' || direction === 'BT') {
    return { x: bounds.x + bounds.width + AUTO_LAYOUT_COLLISION_GAP * 2, y: bounds.y };
  }
  return { x: bounds.x, y: bounds.y + bounds.height + AUTO_LAYOUT_COLLISION_GAP * 2 };
}

function findAnchor(point: EdgePoint, anchors: Anchor[], excludedIds: Set<string> = new Set()): Anchor | undefined {
  const candidates = anchors.filter((anchor) => !excludedIds.has(anchor.id));
  const containing = candidates
    .filter((anchor) => pointInRect(point, anchor.oldRect))
    .sort((a, b) => (a.oldRect.width * a.oldRect.height) - (b.oldRect.width * b.oldRect.height));
  if (containing.length > 0) return containing[0];

  return candidates.sort((a, b) => {
    const distance = distanceSquared(point, rectCenter(a.oldRect)) - distanceSquared(point, rectCenter(b.oldRect));
    return distance !== 0 ? distance : sortById(a.id, b.id);
  })[0];
}

function anchorDelta(anchor: Anchor | undefined): EdgePoint {
  if (!anchor) return { x: 0, y: 0 };
  const oldCenter = rectCenter(anchor.oldRect);
  const newCenter = rectCenter(anchor.newRect);
  return { x: newCenter.x - oldCenter.x, y: newCenter.y - oldCenter.y };
}

function edgeBoundingRect(from: EdgePoint, to: EdgePoint): Rect {
  const left = Math.min(from.x, to.x) - DETACHED_EDGE_PADDING;
  const top = Math.min(from.y, to.y) - DETACHED_EDGE_PADDING;
  const right = Math.max(from.x, to.x) + DETACHED_EDGE_PADDING;
  const bottom = Math.max(from.y, to.y) + DETACHED_EDGE_PADDING;
  return {
    x: left,
    y: top,
    width: Math.max(right - left, DETACHED_EDGE_PADDING * 2),
    height: Math.max(bottom - top, DETACHED_EDGE_PADDING * 2),
  };
}

function groupContainsNode(groupId: string, groups: DiagramGroup[], nodes: DiagramNode[]): boolean {
  const childGroupIds = groups.filter((group) => group.parentGroupId === groupId).map((group) => group.id);
  return nodes.some((node) => node.parentGroupId === groupId)
    || childGroupIds.some((childId) => groupContainsNode(childId, groups, nodes));
}

function groupDescendantIds(groupId: string, groups: DiagramGroup[]): Set<string> {
  const ids = new Set<string>([groupId]);
  for (const child of groups.filter((group) => group.parentGroupId === groupId)) {
    for (const id of groupDescendantIds(child.id, groups)) ids.add(id);
  }
  return ids;
}

function rebuildSubgraphFrames(diagram: CanonicalDiagram): void {
  const groups = diagram.groups ?? [];
  const byId = new Map(groups.map((group) => [group.id, group]));
  const depth = (group: DiagramGroup): number => {
    let result = 0;
    let current = group;
    const seen = new Set<string>();
    while (current.parentGroupId && !seen.has(current.parentGroupId)) {
      seen.add(current.parentGroupId);
      const parent = byId.get(current.parentGroupId);
      if (!parent) break;
      current = parent;
      result++;
    }
    return result;
  };

  const deepestFirst = [...groups]
    .filter((group) => group.kind === 'subgraph')
    .sort((a, b) => depth(b) - depth(a));

  for (const group of deepestFirst) {
    const childRects = [
      ...diagram.nodes.filter((node) => node.parentGroupId === group.id).map(nodeRect),
      ...groups.filter((child) => child.parentGroupId === group.id).map(groupRect),
    ];
    const bounds = diagramBounds(childRects);
    if (!bounds) continue;
    group.position = {
      x: Math.round(bounds.x - MERMAID_LIKE_CLUSTER_PADDING),
      y: Math.round(bounds.y - MERMAID_LIKE_CLUSTER_PADDING - MERMAID_LIKE_GROUP_TITLE_HEIGHT),
    };
    group.width = Math.round(bounds.width + MERMAID_LIKE_CLUSTER_PADDING * 2);
    group.height = Math.round(
      bounds.height + MERMAID_LIKE_CLUSTER_PADDING * 2 + MERMAID_LIKE_GROUP_TITLE_HEIGHT,
    );
  }
}

function applyConnectedEdgeHandles(edge: DiagramEdge, nodeById: Map<string, DiagramNode>, direction: DiagramDirection): void {
  if (edge.from.kind !== 'connected' || edge.to.kind !== 'connected') return;
  const source = nodeById.get(edge.from.nodeId);
  const target = nodeById.get(edge.to.nodeId);
  if (!source || !target) return;
  const sourceCenter = rectCenter(nodeRect(source));
  const targetCenter = rectCenter(nodeRect(target));
  const handles = selectHandlesDirectionAware(sourceCenter, targetCenter, direction);
  edge.from.handleId = handles.sourceHandle;
  edge.to.handleId = handles.targetHandle;
  edge.sourceHandle = handles.sourceHandle;
  edge.targetHandle = handles.targetHandle;
}

function placeCanvasOnlyGeometry(original: CanonicalDiagram, diagram: CanonicalDiagram): void {
  const originalNodeById = new Map(original.nodes.map((node) => [node.id, node]));
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const originalGroups = original.groups ?? [];
  const groups = diagram.groups ?? [];
  const originalGroupById = new Map(originalGroups.map((group) => [group.id, group]));

  const nonEmptyGroupIds = new Set(
    groups.filter((group) => groupContainsNode(group.id, groups, diagram.nodes)).map((group) => group.id),
  );
  const anchors: Anchor[] = [];
  for (const node of diagram.nodes) {
    const oldNode = originalNodeById.get(node.id);
    if (oldNode) anchors.push({ id: node.id, oldRect: nodeRect(oldNode), newRect: nodeRect(node) });
  }
  for (const group of groups) {
    const oldGroup = originalGroupById.get(group.id);
    if (oldGroup && nonEmptyGroupIds.has(group.id)) {
      anchors.push({ id: group.id, oldRect: groupRect(oldGroup), newRect: groupRect(group) });
    }
  }

  const obstacles = diagram.nodes.map(nodeRect);
  const coreBounds = () => diagramBounds([
    ...diagram.nodes.map(nodeRect),
    ...groups.filter((group) => nonEmptyGroupIds.has(group.id)).map(groupRect),
    ...obstacles,
  ]);

  const emptyGroupIds = new Set(groups.filter((group) => !nonEmptyGroupIds.has(group.id)).map((group) => group.id));
  const emptyRoots = groups
    .filter((group) => emptyGroupIds.has(group.id) && (!group.parentGroupId || !emptyGroupIds.has(group.parentGroupId)))
    .sort((a, b) => sortById(a.id, b.id));

  for (const group of emptyRoots) {
    const oldGroup = originalGroupById.get(group.id) ?? group;
    const excludedIds = groupDescendantIds(group.id, groups);
    const anchor = findAnchor(rectCenter(groupRect(oldGroup)), anchors, excludedIds);
    const delta = anchorDelta(anchor);
    const preferred = anchor
      ? { x: oldGroup.position.x + delta.x, y: oldGroup.position.y + delta.y }
      : stagingPosition(diagram.direction, coreBounds());
    const position = findFreePosition(preferred, { width: group.width, height: group.height }, obstacles);
    const shift = { x: position.x - group.position.x, y: position.y - group.position.y };
    for (const descendantId of excludedIds) {
      const descendant = groups.find((candidate) => candidate.id === descendantId);
      if (descendant) {
        descendant.position = {
          x: Math.round(descendant.position.x + shift.x),
          y: Math.round(descendant.position.y + shift.y),
        };
      }
    }
    obstacles.push({ ...position, width: group.width, height: group.height });
  }

  const originalTextById = new Map(original.textBoxes.map((textBox) => [textBox.id, textBox]));
  for (const textBox of [...diagram.textBoxes].sort((a, b) => sortById(a.id, b.id))) {
    const oldTextBox = originalTextById.get(textBox.id) ?? textBox;
    const width = textBox.width ?? 150;
    const height = textBox.height ?? 80;
    const oldRect = {
      x: oldTextBox.position.x,
      y: oldTextBox.position.y,
      width: oldTextBox.width ?? 150,
      height: oldTextBox.height ?? 80,
    };
    const anchor = findAnchor(rectCenter(oldRect), anchors);
    const delta = anchorDelta(anchor);
    const preferred = anchor
      ? { x: oldTextBox.position.x + delta.x, y: oldTextBox.position.y + delta.y }
      : stagingPosition(diagram.direction, coreBounds());
    textBox.position = findFreePosition(preferred, { width, height }, obstacles);
    obstacles.push({ ...textBox.position, width, height });
  }

  const originalEdgeById = new Map(original.edges.map((edge) => [edge.id, edge]));
  for (const edge of [...diagram.edges].sort((a, b) => sortById(a.id, b.id))) {
    const oldEdge = originalEdgeById.get(edge.id) ?? edge;
    if (!isExportableEdge(edge)) edge.data = undefined;

    if (edge.from.kind === 'detached' && edge.to.kind === 'detached'
      && oldEdge.from.kind === 'detached' && oldEdge.to.kind === 'detached') {
      const oldRect = edgeBoundingRect(oldEdge.from.point, oldEdge.to.point);
      const anchor = findAnchor(rectCenter(oldRect), anchors);
      const delta = anchorDelta(anchor);
      const preferred = anchor
        ? { x: oldRect.x + delta.x, y: oldRect.y + delta.y }
        : stagingPosition(diagram.direction, coreBounds());
      const position = findFreePosition(preferred, { width: oldRect.width, height: oldRect.height }, obstacles);
      const shift = { x: position.x - oldRect.x, y: position.y - oldRect.y };
      edge.from.point = {
        x: Math.round(oldEdge.from.point.x + shift.x),
        y: Math.round(oldEdge.from.point.y + shift.y),
      };
      edge.to.point = {
        x: Math.round(oldEdge.to.point.x + shift.x),
        y: Math.round(oldEdge.to.point.y + shift.y),
      };
      obstacles.push(edgeBoundingRect(edge.from.point, edge.to.point));
      continue;
    }

    const moveDetachedEndpoint = (endpoint: 'from' | 'to') => {
      const currentEndpoint = edge[endpoint];
      const oldEndpoint = oldEdge[endpoint];
      if (currentEndpoint.kind !== 'detached' || oldEndpoint.kind !== 'detached') return;
      const connectedEndpoint = endpoint === 'from' ? oldEdge.to : oldEdge.from;
      if (connectedEndpoint.kind !== 'connected') return;
      const oldNode = originalNodeById.get(connectedEndpoint.nodeId);
      const newNode = nodeById.get(connectedEndpoint.nodeId);
      if (!oldNode || !newNode) return;
      const oldCenter = rectCenter(nodeRect(oldNode));
      const newCenter = rectCenter(nodeRect(newNode));
      currentEndpoint.point = {
        x: Math.round(oldEndpoint.point.x + newCenter.x - oldCenter.x),
        y: Math.round(oldEndpoint.point.y + newCenter.y - oldCenter.y),
      };
    };
    moveDetachedEndpoint('from');
    moveDetachedEndpoint('to');
  }
}

export async function autoLayoutDiagram(input: CanonicalDiagram): Promise<AutoLayoutResult> {
  const original = deepClone(input);
  const diagram = deepClone(input);
  const exportableEdges = diagram.edges.filter(isExportableEdge);
  const orderOfAppearance = [...diagram.nodes].sort((a, b) => sortById(a.id, b.id)).map((node) => node.id);
  const layout = layoutImportedDiagram(
    diagram.nodes,
    exportableEdges,
    diagram.direction,
    orderOfAppearance,
    diagram.groups,
  );

  for (const node of diagram.nodes) {
    const position = layout.positions.get(node.id);
    if (position) node.position = position;
  }
  for (const group of diagram.groups ?? []) {
    const position = layout.groupPositions?.get(group.id);
    const size = layout.groupSizes?.get(group.id);
    if (position) group.position = position;
    if (size) {
      group.width = size.width;
      group.height = size.height;
    }
  }

  const exportableIds = new Set(exportableEdges.map((edge) => edge.id));
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  for (const edge of diagram.edges) {
    if (exportableIds.has(edge.id)) {
      const handles = layout.handles.get(edge.id);
      if (handles && edge.from.kind === 'connected' && edge.to.kind === 'connected') {
        edge.from.handleId = handles.sourceHandle;
        edge.to.handleId = handles.targetHandle;
        edge.sourceHandle = handles.sourceHandle;
        edge.targetHandle = handles.targetHandle;
      }
      const route = layout.edgeRoutes?.get(edge.id);
      const curve: ImportedEdgeCurve = edge.data?.curve ?? 'basis';
      edge.data = route ? { ...route, curve } : undefined;
    } else if (edge.from.kind === 'connected' && edge.to.kind === 'connected') {
      applyConnectedEdgeHandles(edge, nodeById, diagram.direction);
      edge.data = undefined;
    } else {
      edge.data = undefined;
    }
  }

  let mode: AutoLayoutResult['mode'] = 'dagre-fallback';
  const warnings: string[] = [];
  let diagnostics: LayoutOracleDiagnostics | undefined;
  const hasLanes = (diagram.groups ?? []).some((group) => group.kind === 'lane');

  if (diagram.nodes.length > 0 && !hasLanes) {
    const refinement = await refineMermaidLayoutWithSvg(toMermaid(diagram), diagram);
    diagnostics = refinement.diagnostics;
    if (diagnostics.fallbackUsed) {
      warnings.push(`Mermaid SVG refinement unavailable; local Dagre layout was used${diagnostics.fallbackReason ? ` (${diagnostics.fallbackReason})` : ''}.`);
    } else {
      mode = 'mermaid-svg';
      if ((diagram.groups ?? []).length > 0) rebuildSubgraphFrames(diagram);
    }
  }

  // The oracle can change node centers, so refresh every connected canvas-only
  // edge after refinement. Exportable routes were already rebased by the oracle.
  const refinedNodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  for (const edge of diagram.edges) {
    if (!exportableIds.has(edge.id) && edge.from.kind === 'connected' && edge.to.kind === 'connected') {
      applyConnectedEdgeHandles(edge, refinedNodeById, diagram.direction);
    }
  }

  placeCanvasOnlyGeometry(original, diagram);

  return { diagram, mode, warnings, diagnostics };
}
