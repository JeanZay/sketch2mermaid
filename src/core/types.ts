/**
 * Map of Mermaid syntax to Sketch2Mermaid NodeShape identifiers:
 *
 * Mermaid syntax                      -> NodeShape
 * --------------------------------------------------
 * A[Label]                            -> process
 * A(Label)                            -> rounded
 * A([Label])                          -> stadium
 * A{Label}                            -> decision
 * A((Label))                          -> event
 * A(((Label)))                        -> endEvent
 * A[(Label)]                          -> database
 * A@{ shape: doc, label: "Label" }      -> file
 * A[[Label]]                          -> subroutine
 * A{{Label}}                          -> hexagon
 * A[/Label/]                          -> parallelogram
 * A[\Label\]                          -> parallelogramAlt
 * A[/Label\]                          -> trapezoid
 * A[\Label/]                          -> trapezoidAlt
 * A>Label]                            -> asymmetric
 * A@{ shape: docs, label: "Label" }     -> documents
 */
export type NodeShape = 'process' | 'rounded' | 'stadium' | 'decision' | 'event' | 'endEvent' | 'database' | 'file' | 'subroutine' | 'hexagon' | 'parallelogram' | 'parallelogramAlt' | 'trapezoid' | 'trapezoidAlt' | 'asymmetric' | 'documents';
export type EdgeStyle = 'solid' | 'dotted';
export type EdgeDirection = 'directed' | 'undirected' | 'bidirectional' | 'reverse';
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

export interface ConnectedEdgeEndpoint {
  kind: 'connected';
  nodeId: string;
  handleId?: string | null;
}

export interface DetachedEdgeEndpoint {
  kind: 'detached';
  point: {
    x: number;
    y: number;
  };
}

export type DiagramEdgeEndpoint =
  | ConnectedEdgeEndpoint
  | DetachedEdgeEndpoint;

export type EdgeConnectionStatus = 'connected' | 'detached';
export type EdgeExportMode = 'mermaid' | 'canvasOnly';

export interface DiagramEdge {
  id: string;
  from: DiagramEdgeEndpoint;
  to: DiagramEdgeEndpoint;
  connectionStatus: EdgeConnectionStatus;
  exportMode: EdgeExportMode;
  label: string; // "" means no label
  style: EdgeStyle;
  direction?: EdgeDirection;
  
  /**
   * Canvas-only visual text styling for the label.
   * Not exported to Mermaid.
   */
  textStyle?: TextStyle;

  // Backward compatibility
  sourceHandle?: string | null;
  targetHandle?: string | null;
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

export function isConnectedEndpoint(endpoint: DiagramEdgeEndpoint): endpoint is ConnectedEdgeEndpoint {
  return endpoint && (typeof endpoint === 'string' || endpoint.kind === 'connected');
}

export function isDetachedEndpoint(endpoint: DiagramEdgeEndpoint): endpoint is DetachedEdgeEndpoint {
  return endpoint && typeof endpoint !== 'string' && endpoint.kind === 'detached';
}

export function isStructurallyConnectedEdge(edge: DiagramEdge): boolean {
  const fromKind = typeof edge.from === 'string' ? 'connected' : edge.from?.kind;
  const toKind = typeof edge.to === 'string' ? 'connected' : edge.to?.kind;
  return fromKind === 'connected' && toKind === 'connected';
}

export function isStructurallyDetachedEdge(edge: DiagramEdge): boolean {
  return !isStructurallyConnectedEdge(edge);
}

export function isExportableEdge(edge: DiagramEdge): boolean {
  return isStructurallyConnectedEdge(edge) && edge.exportMode !== 'canvasOnly';
}

