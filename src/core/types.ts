export type NodeShape = 'process' | 'rounded' | 'stadium' | 'decision' | 'event' | 'endEvent';
export type EdgeStyle = 'solid' | 'dotted';
export type DiagramDirection = 'TD' | 'LR' | 'BT' | 'RL';

export interface DiagramNode {
  id: string;
  label: string;
  shape: NodeShape;
  position: { x: number; y: number };
}

export interface DiagramEdge {
  id: string;
  from: string; // references a node.id
  to: string;   // references a node.id
  sourceHandle?: string;
  targetHandle?: string;
  label: string; // "" means no label
  style: EdgeStyle;
}

export interface CanonicalDiagram {
  schemaVersion: number;
  diagramType: 'flowchart';
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type MermaidExportFormat = 'markdown' | 'html' | 'raw';

