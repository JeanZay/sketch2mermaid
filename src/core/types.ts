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

export type TextBoxStyle = TextStyle;

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

