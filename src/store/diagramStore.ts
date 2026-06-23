import { create } from 'zustand';
import type { CanonicalDiagram, DiagramNode, DiagramEdge, TextBox, TextBoxStyle, NodeShape, EdgeStyle, DiagramDirection, NodeStyle } from '../core/types';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';

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
  fontSize: 14,
  bold: false,
  italic: false,
  textAlign: 'center',
  color: '#4b5563',
};

export const DEFAULT_TEXT_BOX_STYLE: TextBoxStyle = {
  fontSize: 14,
  bold: false,
  italic: false,
  textAlign: 'left',
  color: '#374151',
};

/**
 * Centralizes diagram normalization: ensures all optional/additive fields
 * are present with correct defaults. Called at load and import boundaries.
 */
export function normalizeDiagram(raw: CanonicalDiagram): CanonicalDiagram {
  const textBoxes = Array.isArray(raw.textBoxes) ? raw.textBoxes : [];
  const nodes = Array.isArray(raw.nodes)
    ? raw.nodes.map((node) => {
        // @ts-expect-error - legacy field migration
        if (node.textStyle) {
          const { textStyle, ...rest } = node as { textStyle?: unknown } & DiagramNode;
          return {
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
        return node;
      })
    : [];
  return {
    ...raw,
    nodes,
    textBoxes,
  };
}

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
  setDirection: (direction: DiagramDirection) => void;
  addNode: (shape: NodeShape, x: number, y: number) => string;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeShape: (id: string, shape: NodeShape) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  updateNodeTextStyle: (id: string, style: Partial<TextStyle>) => void;
  updateNodeStyle: (id: string, style: Partial<NodeStyle>) => void;
  deleteNode: (id: string) => void;
  addEdge: (from: string, to: string, style?: EdgeStyle, sourceHandle?: string, targetHandle?: string) => string;
  updateEdgeLabel: (id: string, label: string) => void;
  updateEdgeTextStyle: (id: string, style: Partial<import('../core/types').TextStyle>) => void;
  toggleEdgeStyle: (id: string) => void;
  deleteEdge: (id: string) => void;
  addTextBox: (x: number, y: number) => string;
  updateTextBoxText: (id: string, text: string) => void;
  updateTextBoxStyle: (id: string, style: Partial<TextBoxStyle>) => void;
  updateTextBoxPosition: (id: string, x: number, y: number) => void;
  deleteTextBox: (id: string) => void;
  resetDiagram: () => void;
  loadDiagram: (diagram: CanonicalDiagram) => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  diagram: loadInitialDiagram(),

  setDirection: (direction) => {
    set((state) => ({
      diagram: { ...state.diagram, direction },
    }));
  },

  addNode: (shape, x, y) => {
    const newId = getNextNodeId(get().diagram.nodes);
    
    let targetX = Math.round(x);
    let targetY = Math.round(y);
    const nodes = get().diagram.nodes;
    // Check if any node is within a 20px radius of the target position
    while (nodes.some((n) => Math.abs(n.position.x - targetX) < 20 && Math.abs(n.position.y - targetY) < 20)) {
      targetX += 30;
      targetY += 30;
    }

    const sizeDefaults = NODE_SIZE_DEFAULTS[shape];
    const newNode: DiagramNode = {
      id: newId,
      label: 'Nouveau nœud',
      shape,
      position: { x: targetX, y: targetY },
      width: sizeDefaults.width,
      height: sizeDefaults.height,
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id ? { ...node, label } : node
        ),
      },
    }));
  },

  updateNodeShape: (id, shape) => {
    const sizeDefaults = NODE_SIZE_DEFAULTS[shape];
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id
            ? { ...node, shape, width: sizeDefaults.width, height: sizeDefaults.height }
            : node
        ),
      },
    }));
  },

  updateNodePosition: (id, x, y) => {
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) => {
          if (node.id !== id) return node;
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.filter((node) => node.id !== id),
        // AC13: Remove incident edges
        edges: state.diagram.edges.filter(
          (edge) => edge.from !== id && edge.to !== id
        ),
      },
    }));
  },

  addEdge: (from, to, style = 'solid', sourceHandle, targetHandle) => {
    // Prevent duplicate edges considering nodes and handles
    const existing = get().diagram.edges.find(
      (e) =>
        e.from === from &&
        e.to === to &&
        e.sourceHandle === sourceHandle &&
        e.targetHandle === targetHandle
    );
    if (existing) return existing.id;

    const newId = getNextEdgeId(get().diagram.edges);
    const newEdge: DiagramEdge = {
      id: newId,
      from,
      to,
      sourceHandle,
      targetHandle,
      label: '',
      style,
    };
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: [...state.diagram.edges, newEdge],
      },
    }));
    return newId;
  },

  updateEdgeLabel: (id, label) => {
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.map((edge) =>
          edge.id === id ? { ...edge, textStyle: { ...edge.textStyle, ...style } } : edge
        ),
      },
    }));
  },

  toggleEdgeStyle: (id) => {
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        edges: state.diagram.edges.filter((edge) => edge.id !== id),
      },
    }));
  },

  addTextBox: (x, y) => {
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) =>
          tb.id === id ? { ...tb, text } : tb
        ),
      },
    }));
  },

  updateTextBoxStyle: (id, style) => {
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.map((tb) =>
          tb.id === id ? { ...tb, style: { ...tb.style, ...style } } : tb
        ),
      },
    }));
  },

  updateTextBoxPosition: (id, x, y) => {
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        textBoxes: state.diagram.textBoxes.filter((tb) => tb.id !== id),
      },
    }));
  },

  resetDiagram: () => {
    set({ diagram: { ...defaultDiagram } });
  },

  loadDiagram: (diagram) => {
    set({ diagram: normalizeDiagram(diagram) });
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
