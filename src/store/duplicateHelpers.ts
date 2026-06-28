import type { CanonicalDiagram, DiagramNode, DiagramEdge, TextBox } from '../core/types';
import { getNextNodeId, getNextEdgeId, getNextTextBoxId } from './diagramStore';

export interface CopiedSelectionSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  textBoxes: TextBox[];
}

export interface DuplicateResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  textBoxes: TextBox[];
  nodeIds: string[];
  edgeIds: string[];
  textBoxIds: string[];
}

export const DUPLICATE_OFFSET = { x: 32, y: 32 };

export function getEndpointCoordinates(
  endpoint: import('../core/types').DiagramEdgeEndpoint,
  nodes: DiagramNode[]
): { x: number; y: number } {
  if (endpoint.kind === 'detached') {
    return { ...endpoint.point };
  }
  const node = nodes.find((n) => n.id === endpoint.nodeId);
  if (!node) {
    return { x: 0, y: 0 };
  }
  const width = node.width ?? 100;
  const height = node.height ?? 40;
  const handleId = endpoint.handleId;

  let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
  if (handleId) {
    if (handleId.startsWith('t-')) side = 'top';
    else if (handleId.startsWith('b-')) side = 'bottom';
    else if (handleId.startsWith('l-')) side = 'left';
    else if (handleId.startsWith('r-')) side = 'right';
  }

  switch (side) {
    case 'top': return { x: node.position.x + width / 2, y: node.position.y };
    case 'bottom': return { x: node.position.x + width / 2, y: node.position.y + height };
    case 'left': return { x: node.position.x, y: node.position.y + height / 2 };
    case 'right': return { x: node.position.x + width, y: node.position.y + height / 2 };
    default: return { x: node.position.x + width / 2, y: node.position.y + height / 2 };
  }
}

export function buildCopiedSelectionSnapshot(
  diagram: CanonicalDiagram,
  input: { nodeIds: string[]; edgeIds: string[]; textBoxIds: string[] }
): CopiedSelectionSnapshot {
  const nodeIdsSet = new Set(input.nodeIds);
  const edgeIdsSet = new Set(input.edgeIds);
  const textBoxIdsSet = new Set(input.textBoxIds);

  const nodes = diagram.nodes
    .filter((n) => nodeIdsSet.has(n.id))
    .map((n) => JSON.parse(JSON.stringify(n)));

  const textBoxes = diagram.textBoxes
    .filter((tb) => textBoxIdsSet.has(tb.id))
    .map((tb) => JSON.parse(JSON.stringify(tb)));

  const edgeList: DiagramEdge[] = [];

  // Find all internal edges
  const internalEdges = diagram.edges.filter((e) => {
    const isFromConnected = e.from.kind === 'connected';
    const isToConnected = e.to.kind === 'connected';
    return (
      isFromConnected &&
      isToConnected &&
      nodeIdsSet.has(e.from.nodeId) &&
      nodeIdsSet.has(e.to.nodeId)
    );
  });

  edgeList.push(...internalEdges);

  // Find explicitly selected edges
  const explicitlySelectedEdges = diagram.edges.filter((e) => edgeIdsSet.has(e.id));
  for (const edge of explicitlySelectedEdges) {
    const fromId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
    const toId = edge.to.kind === 'connected' ? edge.to.nodeId : null;

    const fromSelected = fromId && nodeIdsSet.has(fromId);
    const toSelected = toId && nodeIdsSet.has(toId);

    // If both endpoints are selected nodes, it is already added if it was connected.
    // If only one is selected, we skip it per specifications (no ambiguous half-connected edges).
    // If neither endpoint is a selected node, we duplicate it as a detached ghost edge.
    if (!fromSelected && !toSelected) {
      if (!edgeList.some((e) => e.id === edge.id)) {
        edgeList.push(edge);
      }
    }
  }

  // Deduplicate by ID
  const uniqueEdges = edgeList.map((e) => JSON.parse(JSON.stringify(e)));

  return {
    nodes,
    textBoxes,
    edges: uniqueEdges,
  };
}

export function createDuplicatesFromSnapshot(
  snapshot: CopiedSelectionSnapshot,
  currentDiagram: CanonicalDiagram
): DuplicateResult {
  const nodeIdMap = new Map<string, string>();
  const clonedNodes: DiagramNode[] = [];
  const clonedTextBoxes: TextBox[] = [];
  const clonedEdges: DiagramEdge[] = [];

  const currentGroups = currentDiagram.groups || [];

  const tempNodes = [...currentDiagram.nodes];
  const tempTextBoxes = [...currentDiagram.textBoxes];
  const tempEdges = [...currentDiagram.edges];

  // 1. Clone nodes
  for (const node of snapshot.nodes) {
    const freshId = getNextNodeId(tempNodes);
    nodeIdMap.set(node.id, freshId);

    const safeParentGroupId =
      node.parentGroupId && currentGroups.some((g) => g.id === node.parentGroupId)
        ? node.parentGroupId
        : undefined;

    const clonedNode: DiagramNode = {
      ...node,
      id: freshId,
      position: {
        x: node.position.x + DUPLICATE_OFFSET.x,
        y: node.position.y + DUPLICATE_OFFSET.y,
      },
      parentGroupId: safeParentGroupId,
    };
    clonedNodes.push(clonedNode);
    tempNodes.push(clonedNode);
  }

  // 2. Clone textboxes
  for (const tb of snapshot.textBoxes) {
    const freshId = getNextTextBoxId(tempTextBoxes);
    const clonedTextBox: TextBox = {
      ...tb,
      id: freshId,
      position: {
        x: tb.position.x + DUPLICATE_OFFSET.x,
        y: tb.position.y + DUPLICATE_OFFSET.y,
      },
    };
    clonedTextBoxes.push(clonedTextBox);
    tempTextBoxes.push(clonedTextBox);
  }

  // 3. Clone edges
  for (const edge of snapshot.edges) {
    const freshId = getNextEdgeId(tempEdges);

    const fromId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
    const toId = edge.to.kind === 'connected' ? edge.to.nodeId : null;

    const isFromCloned = fromId && nodeIdMap.has(fromId);
    const isToCloned = toId && nodeIdMap.has(toId);

    let newFrom: import('../core/types').DiagramEdgeEndpoint;
    let newTo: import('../core/types').DiagramEdgeEndpoint;
    let connectionStatus = edge.connectionStatus;
    let exportMode = edge.exportMode;

    if (isFromCloned && isToCloned) {
      newFrom = {
        kind: 'connected',
        nodeId: nodeIdMap.get(fromId!)!,
        handleId: edge.from.kind === 'connected' ? edge.from.handleId : undefined,
      };
      newTo = {
        kind: 'connected',
        nodeId: nodeIdMap.get(toId!)!,
        handleId: edge.to.kind === 'connected' ? edge.to.handleId : undefined,
      };
    } else {
      const rawFromPoint = getEndpointCoordinates(edge.from, currentDiagram.nodes);
      const rawToPoint = getEndpointCoordinates(edge.to, currentDiagram.nodes);

      newFrom = {
        kind: 'detached',
        point: {
          x: rawFromPoint.x + DUPLICATE_OFFSET.x,
          y: rawFromPoint.y + DUPLICATE_OFFSET.y,
        },
      };

      newTo = {
        kind: 'detached',
        point: {
          x: rawToPoint.x + DUPLICATE_OFFSET.x,
          y: rawToPoint.y + DUPLICATE_OFFSET.y,
        },
      };

      connectionStatus = 'detached';
      exportMode = 'canvasOnly';
    }

    const clonedEdge: DiagramEdge = {
      ...edge,
      id: freshId,
      from: newFrom,
      to: newTo,
      connectionStatus,
      exportMode,
      sourceHandle: newFrom.kind === 'connected' ? newFrom.handleId : null,
      targetHandle: newTo.kind === 'connected' ? newTo.handleId : null,
    };

    clonedEdges.push(clonedEdge);
    tempEdges.push(clonedEdge);
  }

  return {
    nodes: clonedNodes,
    edges: clonedEdges,
    textBoxes: clonedTextBoxes,
    nodeIds: clonedNodes.map((n) => n.id),
    edgeIds: clonedEdges.map((e) => e.id),
    textBoxIds: clonedTextBoxes.map((tb) => tb.id),
  };
}
