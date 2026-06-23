export type NodeShape = 'process' | 'rounded' | 'stadium' | 'decision' | 'event' | 'endEvent' | 'database' | 'file';
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

export interface TextBoxStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

export interface TextBox {
  id: string;
  text: string;
  position: { x: number; y: number };
  style: TextBoxStyle;
}

export interface CanonicalDiagram {
  schemaVersion: number;
  diagramType: 'flowchart';
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  textBoxes: TextBox[];
}

export type MermaidExportFormat = 'markdown' | 'html' | 'raw';

