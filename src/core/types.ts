export type NodeShape = 'process' | 'rounded' | 'stadium' | 'decision' | 'event' | 'endEvent' | 'database' | 'file';
export type EdgeStyle = 'solid' | 'dotted';
export type DiagramDirection = 'TD' | 'LR' | 'BT' | 'RL';

export interface DiagramNode {
  id: string;
  label: string;
  shape: NodeShape;
  position: { x: number; y: number };

  /**
   * Canvas-only visual dimensions.
   * These are used by the React Flow canvas and must not be exported to Mermaid.
   */
  width?: number;
  height?: number;

  /** @deprecated legacy canvas-only field. Use style.text instead. */
  textStyle?: TextStyle;

  style?: NodeStyle;
}

export interface DiagramEdge {
  id: string;
  from: string; // references a node.id
  to: string;   // references a node.id
  sourceHandle?: string;
  targetHandle?: string;
  label: string; // "" means no label
  style: EdgeStyle;
  
  /**
   * Canvas-only visual text styling for the label.
   * Not exported to Mermaid.
   */
  textStyle?: TextStyle;
}

export interface TextStyle {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  text?: TextStyle;
}

export interface TextBoxStyle extends TextStyle {
  backgroundColor?: string;
  borderColor?: string;
}

export interface TextBox {
  id: string;
  text: string;
  position: { x: number; y: number };
  style: TextBoxStyle;
  width?: number;
  height?: number;
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

/** Viewport state captured from the canvas. Named S2m- to avoid conflict with React Flow's Viewport type. */
export interface S2mViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Root structure of a .s2m file (JSON UTF-8) */
export interface Sketch2MermaidFile {
  fileType: 'sketch2mermaid';
  fileVersion: 1;
  appVersion: string;
  exportedAt: string; // ISO 8601
  diagram: CanonicalDiagram;
  viewport?: S2mViewport;
}

