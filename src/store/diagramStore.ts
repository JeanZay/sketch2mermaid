import { create } from 'zustand';
import type { CanonicalDiagram, DiagramNode, DiagramEdge, NodeShape, EdgeStyle, DiagramDirection } from '../core/types';

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'sketch2mermaid_diagram_v1';

export const defaultDiagram: CanonicalDiagram = {
  schemaVersion: SCHEMA_VERSION,
  diagramType: 'flowchart',
  direction: 'TD',
  nodes: [],
  edges: [],
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

    return parsed as CanonicalDiagram;
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
  deleteNode: (id: string) => void;
  addEdge: (from: string, to: string, style?: EdgeStyle) => string;
  updateEdgeLabel: (id: string, label: string) => void;
  toggleEdgeStyle: (id: string) => void;
  deleteEdge: (id: string) => void;
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
    
    let targetX = x;
    let targetY = y;
    const nodes = get().diagram.nodes;
    while (nodes.some((n) => n.position.x === targetX && n.position.y === targetY)) {
      targetX += 20;
      targetY += 20;
    }

    const newNode: DiagramNode = {
      id: newId,
      label: 'Nouveau nœud',
      shape,
      position: { x: targetX, y: targetY },
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
    set((state) => ({
      diagram: {
        ...state.diagram,
        nodes: state.diagram.nodes.map((node) =>
          node.id === id ? { ...node, shape } : node
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

  addEdge: (from, to, style = 'solid') => {
    // Prevent duplicate edges
    const existing = get().diagram.edges.find((e) => e.from === from && e.to === to);
    if (existing) return existing.id;

    const newId = getNextEdgeId(get().diagram.edges);
    const newEdge: DiagramEdge = {
      id: newId,
      from,
      to,
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

  resetDiagram: () => {
    set({ diagram: defaultDiagram });
  },

  loadDiagram: (diagram) => {
    set({ diagram });
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
