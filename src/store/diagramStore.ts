import { create } from 'zustand';
import type {
  CanonicalDiagram,
  DiagramNode,
  DiagramEdge,
  TextBox,
  TextBoxStyle,
  NodeShape,
  EdgeStyle,
  EdgeDirection,
  DiagramDirection,
  NodeStyle,
  DiagramEdgeEndpoint,
  TextStyle
} from '../core/types';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';
import { getShapeCapabilities } from '../core/shapeRegistry';

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'sketch2mermaid_diagram_v1';

export const defaultDiagram: CanonicalDiagram = {
  schemaVersion: SCHEMA_VERSION,
  diagramType: 'flowchart',
  direction: 'TD',
  nodes: [],
  edges: [],
  textBoxes: [],
};

// Simple debounce function for autosave
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  } as unknown as T;
}

// Scans existing node IDs to compute the next incremental ID (n1, n2, ...)
export function getNextNodeId(nodes: DiagramNode[]): string {
  let max = 0;
  for (const node of nodes) {
    const match = node.id.match(/^n(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `n${max + 1}`;
}

// Scans existing edge IDs to compute the next incremental ID (e1, e2, ...)
export function getNextEdgeId(edges: DiagramEdge[]): string {
  let max = 0;
  for (const edge of edges) {
    const match = edge.id.match(/^e(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `e${max + 1}`;
}

// Scans existing text box IDs to compute the next incremental ID (tb1, tb2, ...)
export function getNextTextBoxId(textBoxes: TextBox[]): string {
  let max = 0;
  for (const tb of textBoxes) {
    const match = tb.id.match(/^tb(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `tb${max + 1}`;
}

export const DEFAULT_NODE_TEXT_STYLE: import('../core/types').TextStyle = {
  // fontSize is left undefined intentionally to trigger auto-fit fallback `computeNodeFontSize`
  bold: false,
  italic: false,
  textAlign: 'center',
  color: '#000000',
};

export const DEFAULT_EDGE_TEXT_STYLE: import('../core/types').TextStyle = {
  fontSize: 11,
  bold: false,
  italic: false,
  textAlign: 'center',
  color: '#1a1b23',
};

export const DEFAULT_TEXT_BOX_STYLE: TextBoxStyle = {
  fontSize: 14,
  bold: false,
  italic: false,
  textAlign: 'left',
  color: '#374151',
};

export const DEFAULT_TEXT_BOX_WIDTH = 150;
export const DEFAULT_TEXT_BOX_HEIGHT = 80;
export const MIN_TEXT_BOX_WIDTH = 80;
export const MIN_TEXT_BOX_HEIGHT = 40;

function normalizeDimension(value: unknown, fallback: number, min: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.round(n));
}

export const normalizeEdgeDirection = (direction: unknown): EdgeDirection =>
  direction === 'undirected' || direction === 'bidirectional' || direction === 'directed' || direction === 'reverse'
    ? direction
    : 'directed';

export const normalizeEdgeStyle = (style: unknown): EdgeStyle =>
  style === 'dotted' ? 'dotted' : 'solid';

/**
 * Centralizes diagram normalization: ensures all optional/additive fields
 * are present with correct defaults. Called at load and import boundaries.
 */
export function normalizeDiagram(raw: CanonicalDiagram): CanonicalDiagram {
  const textBoxes = Array.isArray(raw.textBoxes)
    ? raw.textBoxes.map((tb) => {
        const style = tb.style || {};
        return {
          ...tb,
          width: normalizeDimension(tb.width, DEFAULT_TEXT_BOX_WIDTH, MIN_TEXT_BOX_WIDTH),
          height: normalizeDimension(tb.height, DEFAULT_TEXT_BOX_HEIGHT, MIN_TEXT_BOX_HEIGHT),
          style: {
            ...style,
            backgroundColor: style.backgroundColor?.trim() || undefined,
            borderColor: style.borderColor?.trim() || undefined,
          },
        };
      })
    : [];
  const nodes = Array.isArray(raw.nodes)
    ? raw.nodes.map((node) => {
        let normalized = node;
        // @ts-expect-error - legacy field migration
        if (node.textStyle) {
          const { textStyle, ...rest } = node as { textStyle?: unknown } & DiagramNode;
          normalized = {
            ...rest,
            style: {
              ...node.style,
              text: {
                ...textStyle,
                ...node.style?.text,
              },
            },
          };
        }
        // Force fixedSize dimensions if fixed sizing mode is active
        const capabilities = getShapeCapabilities(normalized.shape);
        if (capabilities.sizingMode === 'fixed' && capabilities.fixedSize) {
          normalized = {
            ...normalized,
            width: capabilities.fixedSize.width,
            height: capabilities.fixedSize.height,
          };
        }
        if (!capabilities.supportsLabel && normalized.label !== '') {
          normalized = {
            ...normalized,
            label: '',
          };
        }
        return normalized;
      })
    : [];

  const nodeSet = new Set(nodes.map((n) => n.id));

  interface LegacyDiagramEdge {
    id: string;
    from: string | DiagramEdgeEndpoint;
    to: string | DiagramEdgeEndpoint;
    exportMode?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
    style?: string;
    direction?: string;
    textStyle?: TextStyle;
  }

  const edges = Array.isArray(raw.edges)
    ? raw.edges.map((rawEdge: unknown) => {
        const edge = rawEdge as LegacyDiagramEdge;
        let fromEndpoint: DiagramEdgeEndpoint;
        if (typeof edge.from === 'string') {
          if (nodeSet.has(edge.from)) {
            fromEndpoint = {
              kind: 'connected',
              nodeId: edge.from,
              handleId: edge.sourceHandle || null,
            };
          } else {
            fromEndpoint = {
              kind: 'detached',
              point: { x: 100, y: 100 },
            };
          }
        } else if (edge.from && typeof edge.from === 'object') {
          if (edge.from.kind === 'connected') {
            if (nodeSet.has(edge.from.nodeId)) {
              fromEndpoint = {
                kind: 'connected',
                nodeId: edge.from.nodeId,
                handleId: edge.from.handleId || null,
              };
            } else {
              fromEndpoint = {
                kind: 'detached',
                point: edge.from.point || { x: 100, y: 100 },
              };
            }
          } else {
            const pt = edge.from.point || { x: 100, y: 100 };
            const x = typeof pt.x === 'number' && Number.isFinite(pt.x) ? pt.x : 100;
            const y = typeof pt.y === 'number' && Number.isFinite(pt.y) ? pt.y : 100;
            fromEndpoint = {
              kind: 'detached',
              point: { x, y },
            };
          }
        } else {
          fromEndpoint = {
            kind: 'detached',
            point: { x: 100, y: 100 },
          };
        }

        let toEndpoint: DiagramEdgeEndpoint;
        if (typeof edge.to === 'string') {
          if (nodeSet.has(edge.to)) {
            toEndpoint = {
              kind: 'connected',
              nodeId: edge.to,
              handleId: edge.targetHandle || null,
            };
          } else {
            toEndpoint = {
              kind: 'detached',
              point: { x: 200, y: 200 },
            };
          }
        } else if (edge.to && typeof edge.to === 'object') {
          if (edge.to.kind === 'connected') {
            if (nodeSet.has(edge.to.nodeId)) {
              toEndpoint = {
                kind: 'connected',
                nodeId: edge.to.nodeId,
                handleId: edge.to.handleId || null,
              };
            } else {
              toEndpoint = {
                kind: 'detached',
                point: edge.to.point || { x: 200, y: 200 },
              };
            }
          } else {
            const pt = edge.to.point || { x: 200, y: 200 };
            const x = typeof pt.x === 'number' && Number.isFinite(pt.x) ? pt.x : 200;
            const y = typeof pt.y === 'number' && Number.isFinite(pt.y) ? pt.y : 200;
            toEndpoint = {
              kind: 'detached',
              point: { x, y },
            };
          }
        } else {
          toEndpoint = {
            kind: 'detached',
            point: { x: 200, y: 200 },
          };
        }

        const connectionStatus =
          fromEndpoint.kind === 'connected' && toEndpoint.kind === 'connected'
            ? 'connected'
            : 'detached';

        const exportMode = edge.exportMode === 'canvasOnly' ? 'canvasOnly' : 'mermaid';

        return {
          id: edge.id,
          from: fromEndpoint,
          to: toEndpoint,
          connectionStatus,
          exportMode,
          sourceHandle: fromEndpoint.kind === 'connected' ? fromEndpoint.handleId : null,
          targetHandle: toEndpoint.kind === 'connected' ? toEndpoint.handleId : null,
          label: edge.label || '',
          style: normalizeEdgeStyle(edge.style),
          direction: normalizeEdgeDirection(edge.direction),
          textStyle: edge.textStyle,
        };
      })
    : [];

  return {
    ...raw,
    nodes,
    edges,
    textBoxes,
  };
}

/**
 * Compares two CanonicalDiagram instances for structural equality.
 * Normalizes both before comparing to handle optional fields with defaults.
 */
export function areDiagramsEqual(a: CanonicalDiagram, b: CanonicalDiagram): boolean {
  return JSON.stringify(normalizeDiagram(a)) === JSON.stringify(normalizeDiagram(b));
}

const HISTORY_DEPTH_LIMIT = 50;

export function loadInitialDiagram(): CanonicalDiagram {
  if (typeof window === 'undefined') return defaultDiagram;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultDiagram;
    const parsed = JSON.parse(stored);

    // AC14: Schema version validation
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`Unrecognized schemaVersion "${parsed.schemaVersion}". Fallback to empty diagram.`);
      return defaultDiagram;
    }

    // Structural validation to avoid crashes
    if (
      parsed.diagramType !== 'flowchart' ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      console.warn('Invalid diagram structure in localStorage. Fallback to empty diagram.');
      return defaultDiagram;
    }

    return normalizeDiagram(parsed as CanonicalDiagram);
  } catch (e) {
    console.error('Error loading diagram from localStorage. Fallback to empty diagram.', e);
    return defaultDiagram;
  }
}

export interface DiagramState {
  diagram: CanonicalDiagram;

  // History state (not part of CanonicalDiagram — not serialized to exports)
  past: CanonicalDiagram[];
  future: CanonicalDiagram[];
  checkpoint: CanonicalDiagram | null;

  // History actions
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  startTransaction: () => void;
  commitTransaction: () => void;

  setDirection: (direction: DiagramDirection) => void;
  addNode: (shape: NodeShape, x: number, y: number) => string;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeShape: (id: string, shape: NodeShape) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  updateNodeTextStyle: (id: string, style: Partial<TextStyle>) => void;
  updateNodeStyle: (id: string, style: Partial<NodeStyle>) => void;
  deleteNode: (id: string) => void;
  addEdge: (
    from: string | DiagramEdgeEndpoint,
    to: string | DiagramEdgeEndpoint,
    style?: EdgeStyle,
    sourceHandle?: string,
    targetHandle?: string
  ) => string;
  deleteSelectedElements: (params: {
    nodeIds: string[];
    edgeIds: string[];
    textBoxIds: string[];
    connectedEdgeBehavior: 'delete' | 'detach';
    endpointPositions?: Record<string, {
      from?: { x: number; y: number };
      to?: { x: number; y: number };
    }>;
  }) => void;
  moveDetachedEdgeEndpoint: (params: {
    edgeId: string;
    endpoint: 'from' | 'to';
    point: { x: number; y: number };
  }) => void;
  reconnectDetachedEdgeEndpoint: (params: {
    edgeId: string;
    endpoint: 'from' | 'to';
    nodeId: string;
    handleId?: string | null;
  }) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  updateEdgeTextStyle: (id: string, style: Partial<import('../core/types').TextStyle>) => void;
  updateEdgeDirection: (id: string, direction: EdgeDirection) => void;
  toggleEdgeStyle: (id: string) => void;
  deleteEdge: (id: string) => void;
  addTextBox: (x: number, y: number) => string;
  updateTextBoxText: (id: string, text: string) => void;
  updateTextBoxStyle: (id: string, style: Partial<TextBoxStyle>) => void;
  updateTextBoxSize: (id: string, width: number, height: number) => void;
  updateTextBoxPosition: (id: string, x: number, y: number) => void;
  deleteTextBox: (id: string) => void;
  resetDiagram: () => void;
  loadDiagram: (diagram: CanonicalDiagram, options: { resetHistory: boolean }) => void;

  // UI State for right panel
  rightPanelTab: 'export' | 'guide';
  setRightPanelTab: (tab: 'export' | 'guide') => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  diagram: loadInitialDiagram(),
  rightPanelTab: 'export',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  // History state
  past: [],
  future: [],
  checkpoint: null,

  // ---- History actions ----

  takeSnapshot: () => {
    const { checkpoint, past, diagram } = get();
    // During an active transaction, snapshots are deferred to commitTransaction
    if (checkpoint !== null) return;
    // Avoid pushing a duplicate of the last snapshot
    if (past.length > 0 && areDiagramsEqual(past[past.length - 1], diagram)) return;
    set({ past: [...past, diagram].slice(-HISTORY_DEPTH_LIMIT), future: [] });
  },

  undo: () => {
    const { past, diagram, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [...future, diagram],
      diagram: normalizeDiagram(previous),
      checkpoint: null,
    });
  },

  redo: () => {
    const { past, diagram, future } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    set({
      past: [...past, diagram],
      future: future.slice(0, -1),
      diagram: normalizeDiagram(next),
      checkpoint: null,
    });
  },

  startTransaction: () => {
    const { checkpoint, diagram } = get();
    // Idempotent: do not overwrite an existing checkpoint
    if (checkpoint !== null) return;
    set({ checkpoint: diagram });
  },

  commitTransaction: () => {
    const { checkpoint, diagram, past } = get();
    if (checkpoint === null) return;
    // Only create a history entry if something actually changed
    if (!areDiagramsEqual(checkpoint, diagram)) {
      set({
        past: [...past, checkpoint].slice(-HISTORY_DEPTH_LIMIT),
        future: [],
        checkpoint: null,
      });
    } else {
      set({ checkpoint: null });
    }
  },

  // ---- Diagram mutation actions (each calls takeSnapshot at the start) ----

  setDirection: (direction) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: { ...state.diagram, direction },
    }));
  },

  addNode: (shape, x, y) => {
    get().takeSnapshot();
    const newId = getNextNodeId(get().diagram.nodes);
    
    let targetX = Math.round(x);
    let targetY = Math.round(y);
    const nodes = get().diagram.nodes;
    // Check if any node is within a 20px radius of the target position
    while (nodes.some((n) => Math.abs(n.position.x - targetX) < 20 && Math.abs(n.position.y - targetY) < 20)) {
      targetX += 30;
      targetY += 30;
    }

    const capabilities = getShapeCapabilities(shape);
    const isFixed = capabilities.sizingMode === 'fixed' && capabilities.fixedSize;
    const sizeDefaults = NODE_SIZE_DEFAULTS[shape];
    const width = isFixed ? capabilities.fixedSize!.width : sizeDefaults.width;
    const height = isFixed ? capabilities.fixedSize!.height : sizeDefaults.height;

    const newNode: DiagramNode = {
      id: newId,
      label: capabilities.supportsLabel ? 'Nouveau nœud' : '',
      shape,
      position: { x: targetX, y: targetY },
      width,
      height,
    };
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [...state.diagram.nodes, newNode],
      },
    }));
    return newId;
  },

  updateNodeLabel: (id, label) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id ? { ...node, label: getShapeCapabilities(node.shape).supportsLabel ? label : '' } : node
        ),
      },
    }));
  },

  updateNodeShape: (id, shape) => {
    get().takeSnapshot();
    const capabilities = getShapeCapabilities(shape);
    const isFixed = capabilities.sizingMode === 'fixed' && capabilities.fixedSize;
    const sizeDefaults = NODE_SIZE_DEFAULTS[shape];
    const width = isFixed ? capabilities.fixedSize!.width : sizeDefaults.width;
    const height = isFixed ? capabilities.fixedSize!.height : sizeDefaults.height;
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id
            ? { 
                ...node, 
                shape, 
                width, 
                height,
                ...(capabilities.supportsLabel ? {} : { label: '' })
              }
            : node
        ),
      },
    }));
  },

  updateNodePosition: (id, x, y) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id ? { ...node, position: { x, y } } : node
        ),
      },
    }));
  },

  updateNodeSize: (id, width, height) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) => {
          if (node.id !== id) return node;
          const capabilities = getShapeCapabilities(node.shape);
          if (capabilities.sizingMode === 'fixed' && capabilities.fixedSize) {
            return {
              ...node,
              width: capabilities.fixedSize.width,
              height: capabilities.fixedSize.height,
            };
          }
          const sizeConfig = NODE_SIZE_DEFAULTS[node.shape];
          return {
            ...node,
            width: Math.max(sizeConfig.minWidth, Math.round(width)),
            height: Math.max(sizeConfig.minHeight, Math.round(height)),
          };
        }),
      },
    }));
  },

  updateNodeTextStyle: (id, stylePatch) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                style: {
                  ...node.style,
                  text: { ...node.style?.text, ...stylePatch },
                },
              }
            : node
        ),
      },
    }));
  },

  updateNodeStyle: (id, stylePatch) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                style: {
                  ...node.style,
                  ...stylePatch,
                  text: stylePatch.text
                    ? { ...node.style?.text, ...stylePatch.text }
                    : node.style?.text,
                },
              }
            : node
        ),
      },
    }));
  },

  deleteNode: (id) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.filter((node) => node.id !== id),
        edges: state.diagram.edges.filter(
          (edge) => {
            const fromId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
            const toId = edge.to.kind === 'connected' ? edge.to.nodeId : null;
            return fromId !== id && toId !== id;
          }
        ),
      },
    }));
  },

  addEdge: (from, to, style = 'solid', sourceHandle, targetHandle) => {
    const fromEp = typeof from === 'string' ? { kind: 'connected' as const, nodeId: from, handleId: sourceHandle || null } : from;
    const toEp = typeof to === 'string' ? { kind: 'connected' as const, nodeId: to, handleId: targetHandle || null } : to;

    const existing = get().diagram.edges.find(
      (e) => {
        const eFromNode = e.from.kind === 'connected' ? e.from.nodeId : null;
        const eFromHandle = e.from.kind === 'connected' ? e.from.handleId : null;
        const eToNode = e.to.kind === 'connected' ? e.to.nodeId : null;
        const eToHandle = e.to.kind === 'connected' ? e.to.handleId : null;

        const fNode = fromEp.kind === 'connected' ? fromEp.nodeId : null;
        const fHandle = fromEp.kind === 'connected' ? fromEp.handleId : null;
        const tNode = toEp.kind === 'connected' ? toEp.nodeId : null;
        const tHandle = toEp.kind === 'connected' ? toEp.handleId : null;

        return eFromNode === fNode && eFromHandle === fHandle && eToNode === tNode && eToHandle === tHandle;
      }
    );
    if (existing) return existing.id;

    get().takeSnapshot();
    const newId = getNextEdgeId(get().diagram.edges);
    const newEdge: DiagramEdge = {
      id: newId,
      from: fromEp,
      to: toEp,
      sourceHandle: fromEp.kind === 'connected' ? fromEp.handleId : null,
      targetHandle: toEp.kind === 'connected' ? toEp.handleId : null,
      connectionStatus: fromEp.kind === 'connected' && toEp.kind === 'connected' ? 'connected' : 'detached',
      exportMode: 'mermaid',
      label: '',
      style,
      direction: 'directed',
    };
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: [...state.diagram.edges, newEdge],
      },
    }));
    return newId;
  },

  deleteSelectedElements: ({ nodeIds, edgeIds, textBoxIds, connectedEdgeBehavior, endpointPositions }) => {
    get().takeSnapshot();
    const nodeIdSet = new Set(nodeIds);
    const edgeIdSet = new Set(edgeIds);
    const textBoxIdSet = new Set(textBoxIds);

    set((state) => {
      const nextNodes = state.diagram.nodes.filter((node) => !nodeIdSet.has(node.id));
      const nextTextBoxes = state.diagram.textBoxes.filter((tb) => !textBoxIdSet.has(tb.id));

      let nextEdges: DiagramEdge[];
      
      if (connectedEdgeBehavior === 'delete') {
        nextEdges = state.diagram.edges.filter((edge) => {
          if (edgeIdSet.has(edge.id)) return false;
          const fromNodeId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
          const toNodeId = edge.to.kind === 'connected' ? edge.to.nodeId : null;
          if (fromNodeId && nodeIdSet.has(fromNodeId)) return false;
          if (toNodeId && nodeIdSet.has(toNodeId)) return false;
          return true;
        });
      } else {
        nextEdges = state.diagram.edges.map((edge) => {
          if (edgeIdSet.has(edge.id)) return null;

          const fromNodeId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
          const toNodeId = edge.to.kind === 'connected' ? edge.to.nodeId : null;

          const isFromDeleted = fromNodeId && nodeIdSet.has(fromNodeId);
          const isToDeleted = toNodeId && nodeIdSet.has(toNodeId);

          if (!isFromDeleted && !isToDeleted) {
            return edge;
          }

          let newFrom = { ...edge.from };
          let newTo = { ...edge.to };

          if (isFromDeleted) {
            const capturedPos = endpointPositions?.[edge.id]?.from || { x: 100, y: 100 };
            newFrom = {
              kind: 'detached',
              point: capturedPos,
            };
          }

          if (isToDeleted) {
            const capturedPos = endpointPositions?.[edge.id]?.to || { x: 200, y: 200 };
            newTo = {
              kind: 'detached',
              point: capturedPos,
            };
          }

          return {
            ...edge,
            from: newFrom,
            to: newTo,
            sourceHandle: newFrom.kind === 'connected' ? newFrom.handleId : null,
            targetHandle: newTo.kind === 'connected' ? newTo.handleId : null,
            connectionStatus: 'detached' as const,
          };
        }).filter((e): e is DiagramEdge => e !== null);
      }

      return {
        diagram: {
          ...state.diagram,
          nodes: nextNodes,
          textBoxes: nextTextBoxes,
          edges: nextEdges,
        },
      };
    });
  },

  moveDetachedEdgeEndpoint: ({ edgeId, endpoint, point }) => {
    get().takeSnapshot();
    set((state) => {
      const nextEdges = state.diagram.edges.map((edge) => {

        if (edge.id !== edgeId) return edge;
        if (endpoint === 'from') {
          return {
            ...edge,
            from: {
              kind: 'detached' as const,
              point,
            },
            sourceHandle: null,
            connectionStatus: 'detached' as const,
          };
        } else {
          return {
            ...edge,
            to: {
              kind: 'detached' as const,
              point,
            },
            targetHandle: null,
            connectionStatus: 'detached' as const,
          };
        }
      });
      return {
        diagram: {
          ...state.diagram,
          edges: nextEdges,
        },
      };
    });
  },

  reconnectDetachedEdgeEndpoint: ({ edgeId, endpoint, nodeId, handleId }) => {
    get().takeSnapshot();
    set((state) => {
      const nextEdges = state.diagram.edges.map((edge) => {
        if (edge.id !== edgeId) return edge;

        let newFrom = { ...edge.from };
        let newTo = { ...edge.to };

        if (endpoint === 'from') {
          newFrom = {
            kind: 'connected' as const,
            nodeId,
            handleId: handleId || null,
          };
        } else {
          newTo = {
            kind: 'connected' as const,
            nodeId,
            handleId: handleId || null,
          };
        }

        const connectionStatus =
          newFrom.kind === 'connected' && newTo.kind === 'connected'
            ? ('connected' as const)
            : ('detached' as const);

        return {
          ...edge,
          from: newFrom,
          to: newTo,
          sourceHandle: newFrom.kind === 'connected' ? newFrom.handleId : null,
          targetHandle: newTo.kind === 'connected' ? newTo.handleId : null,
          connectionStatus,
        };
      });

      return {
        diagram: {
          ...state.diagram,
          edges: nextEdges,
        },
      };
    });
  },

  updateEdgeLabel: (id, label) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.map((edge) =>
          edge.id === id ? { ...edge, label } : edge
        ),
      },
    }));
  },

  updateEdgeTextStyle: (id, style) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.map((edge) =>
          edge.id === id ? { ...edge, textStyle: { ...edge.textStyle, ...style } } : edge
        ),
      },
    }));
  },

  updateEdgeDirection: (id, direction) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.map((edge) =>
          edge.id === id ? { ...edge, direction } : edge
        ),
      },
    }));
  },

  toggleEdgeStyle: (id) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.map((edge) =>
          edge.id === id
            ? { ...edge, style: edge.style === 'solid' ? 'dotted' : 'solid' }
            : edge
        ),
      },
    }));
  },

  deleteEdge: (id) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.filter((edge) => edge.id !== id),
      },
    }));
  },

  addTextBox: (x, y) => {
    get().takeSnapshot();
    const newId = getNextTextBoxId(get().diagram.textBoxes);

    let targetX = Math.round(x);
    let targetY = Math.round(y);
    const allPositions = [
      ...get().diagram.nodes.map((n) => n.position),
      ...get().diagram.textBoxes.map((tb) => tb.position),
    ];
    while (allPositions.some((p) => Math.abs(p.x - targetX) < 20 && Math.abs(p.y - targetY) < 20)) {
      targetX += 30;
      targetY += 30;
    }

    const newTextBox: TextBox = {
      id: newId,
      text: 'Text',
      position: { x: targetX, y: targetY },
      style: { ...DEFAULT_TEXT_BOX_STYLE },
      width: DEFAULT_TEXT_BOX_WIDTH,
      height: DEFAULT_TEXT_BOX_HEIGHT,
    };
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: [...state.diagram.textBoxes, newTextBox],
      },
    }));
    return newId;
  },

  updateTextBoxText: (id, text) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) =>
          tb.id === id ? { ...tb, text } : tb
        ),
      },
    }));
  },

  updateTextBoxStyle: (id, stylePatch) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) => {
          if (tb.id !== id) return tb;
          const newStyle = { ...tb.style, ...stylePatch };
          if (newStyle.backgroundColor !== undefined) {
            newStyle.backgroundColor = newStyle.backgroundColor.trim() || undefined;
          }
          if (newStyle.borderColor !== undefined) {
            newStyle.borderColor = newStyle.borderColor.trim() || undefined;
          }
          return { ...tb, style: newStyle };
        }),
      },
    }));
  },

  updateTextBoxSize: (id, width, height) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) => {
          if (tb.id !== id) return tb;
          return {
            ...tb,
            width: Math.max(MIN_TEXT_BOX_WIDTH, Math.round(width)),
            height: Math.max(MIN_TEXT_BOX_HEIGHT, Math.round(height)),
          };
        }),
      },
    }));
  },

  updateTextBoxPosition: (id, x, y) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) =>
          tb.id === id ? { ...tb, position: { x, y } } : tb
        ),
      },
    }));
  },

  deleteTextBox: (id) => {
    get().takeSnapshot();
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.filter((tb) => tb.id !== id),
      },
    }));
  },

  resetDiagram: () => {
    get().takeSnapshot();
    set({ diagram: { ...defaultDiagram } });
  },

  loadDiagram: (diagram, options) => {
    if (!options) throw new Error('loadDiagram requires an options argument with { resetHistory: boolean }');
    const normalizedDiagram = normalizeDiagram(diagram);
    // Clear checkpoint to prevent stale transactions
    if (options.resetHistory) {
      set({ diagram: normalizedDiagram, past: [], future: [], checkpoint: null });
    } else {
      get().takeSnapshot(); // Snapshot previous state BEFORE updating diagram
      set({ diagram: normalizedDiagram, checkpoint: null });
    }
  },
}));

// Autosave subscription with 300ms debounce
if (typeof window !== 'undefined') {
  const saveToLocalStorage = debounce((diagram: CanonicalDiagram) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    } catch (e) {
      console.error('Failed to save diagram to localStorage', e);
    }
  }, 300);

  useDiagramStore.subscribe((state) => {
    saveToLocalStorage(state.diagram);
  });
}
