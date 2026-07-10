import React, { useEffect, useState, useId } from 'react';
import { EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { useDiagramStore, DEFAULT_EDGE_TEXT_STYLE } from '../store/diagramStore';
import { useVirtualAnchors } from './VirtualAnchorsContext';
import { USE_MERMAID_LIKE_EDGE_RENDERING } from '../core/config';
import { getCanvasEdgePath } from '../utils/edgeRouting';
import { ArrowMarker, MermaidArrowMarker } from './EdgeMarkers';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  selected,
  data,
}: EdgeProps) => {
  // Virtual anchor coordinates for edge distribution
  const virtualAnchors = useVirtualAnchors();
  const anchor = virtualAnchors[id];

  // Use virtual anchor coordinates when available, fall back to React Flow defaults
  const startX = anchor?.sourceX ?? sourceX;
  const startY = anchor?.sourceY ?? sourceY;
  const endX = anchor?.targetX ?? targetX;
  const endY = anchor?.targetY ?? targetY;

  const pathResult = getCanvasEdgePath({
    data,
    sourceX: startX,
    sourceY: startY,
    targetX: endX,
    targetY: endY,
    sourcePosition,
    targetPosition,
  });
  
  const edgePath = pathResult[0];
  const labelX = pathResult[1];
  const labelY = pathResult[2];

  const updateEdgeLabel = useDiagramStore((state) => state.updateEdgeLabel);
  const storeEdge = useDiagramStore((state) => 
    state.diagram.edges.find((e) => e.id === id)
  );
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState((label as string) || '');

  const handleStartEditing = () => {
    setTempLabel((label as string) || '');
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    updateEdgeLabel(id, tempLabel.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishEditing();
    if (e.key === 'Escape') {
      setTempLabel((label as string) || '');
      setIsEditing(false);
    }
  };

  // Derive rendering from the store — the single source of truth
  const isGhost = storeEdge?.connectionStatus === 'detached' || id === 'draft-edge-preview';
  const direction = storeEdge?.direction || 'directed';
  const isDotted = storeEdge?.style === 'dotted';
  
  const color = selected ? '#8b5cf6' : (isGhost ? '#9ca3af' : '#4b5563');
  const opacity = isGhost ? 0.6 : 1.0;

  const strokeWidth = USE_MERMAID_LIKE_EDGE_RENDERING
    ? (selected ? 2 : 1.5)
    : (selected ? 3 : 2);

  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeDasharray: isDotted ? '5,5' : (isGhost ? '4,4' : undefined),
    strokeWidth,
    stroke: color,
    opacity,
    transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
  };

  // Self-managed marker IDs scoped to this edge instance
  const reactId = useId();
  const markerEndId = `${reactId}-end`;
  const markerStartId = `${reactId}-start`;

  const hasMarkerEnd = direction === 'directed' || direction === 'bidirectional';
  const hasMarkerStart = direction === 'reverse' || direction === 'bidirectional';

  const MarkerComponent = USE_MERMAID_LIKE_EDGE_RENDERING ? MermaidArrowMarker : ArrowMarker;

  const textStyleObj = storeEdge ? { ...DEFAULT_EDGE_TEXT_STYLE, ...storeEdge.textStyle } : DEFAULT_EDGE_TEXT_STYLE;
  const edgeTextStyle: React.CSSProperties = {
    fontSize: `${textStyleObj.fontSize}px`,
    fontWeight: textStyleObj.bold ? 'bold' : 'normal',
    fontStyle: textStyleObj.italic ? 'italic' : 'normal',
    color: textStyleObj.color ?? (isGhost ? '#9ca3af' : '#4b5563'),
  };

  useEffect(() => {
    if (!label || typeof window === 'undefined' || !window.location.search.includes('debugMermaidImportLayout=1')) {
      return;
    }

    const source = storeEdge?.from.kind === 'connected' ? storeEdge.from.nodeId : 'detached';
    const target = storeEdge?.to.kind === 'connected' ? storeEdge.to.nodeId : 'detached';
    const sourceHandle = storeEdge?.from.kind === 'connected' ? storeEdge.from.handleId : undefined;
    const targetHandle = storeEdge?.to.kind === 'connected' ? storeEdge.to.handleId : undefined;

    console.debug('[Mermaid Edge Label Debug]', JSON.stringify({
      edgeId: id,
      label: String(label),
      labelX,
      labelY,
      fontSize: textStyleObj.fontSize,
      pathMidX: labelX,
      pathMidY: labelY,
      source,
      target,
      sourceHandle,
      targetHandle,
    }));
  }, [id, label, labelX, labelY, storeEdge, textStyleObj.fontSize]);

  return (
    <>
      {/* Self-contained SVG markers for this edge */}
      <defs>
        {hasMarkerEnd && <MarkerComponent id={markerEndId} color={color} />}
        {hasMarkerStart && <MarkerComponent id={markerStartId} color={color} />}
      </defs>
      <path
        d={edgePath}
        fill="none"
        className="react-flow__edge-path"
        style={edgeStyle}
        markerEnd={hasMarkerEnd ? `url(#${markerEndId})` : undefined}
        markerStart={hasMarkerStart ? `url(#${markerStartId})` : undefined}
      />
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-label-container ${selected ? 'selected' : ''}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity,
            ...edgeTextStyle,
          }}
          onDoubleClick={handleStartEditing}
          title="Double-cliquer pour modifier le label de l'arête"
        >
          {isEditing ? (
            <input
              type="text"
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={handleFinishEditing}
              onKeyDown={handleKeyDown}
              autoFocus
              className="edge-label-input"
              style={edgeTextStyle}
            />
          ) : (
            <span className="edge-label-text">
              {label || (selected ? '+ Label' : '')}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
export default CustomEdge;
