import React, { useState, useId } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useDiagramStore, DEFAULT_EDGE_TEXT_STYLE } from '../store/diagramStore';

/**
 * Inline SVG arrow marker for edges.
 * We render our own markers rather than relying on React Flow's marker
 * resolution pipeline, which can drop `undefined` markers in some
 * reconciliation paths and show stale arrowheads.
 */
const ArrowMarker = ({ id, color }: { id: string; color: string }) => (
  <marker
    id={id}
    markerWidth="20"
    markerHeight="20"
    viewBox="-10 -10 20 20"
    markerUnits="strokeWidth"
    orient="auto-start-reverse"
    refX="0"
    refY="0"
  >
    <polyline
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1"
      fill={color}
      points="-5,-4 0,0 -5,4 -5,-4"
    />
  </marker>
);

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
}: EdgeProps) => {
  const bezier = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  
  const edgePath = bezier[0];
  const labelX = bezier[1];
  const labelY = bezier[2];

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
  const direction = storeEdge?.direction || 'directed';
  const isDotted = storeEdge?.style === 'dotted';
  const color = selected ? '#8b5cf6' : '#4b5563';

  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeDasharray: isDotted ? '5,5' : undefined,
    strokeWidth: selected ? 3 : 2,
    stroke: color,
    transition: 'stroke 0.2s, stroke-width 0.2s',
  };

  // Self-managed marker IDs scoped to this edge instance
  const reactId = useId();
  const markerEndId = `${reactId}-end`;
  const markerStartId = `${reactId}-start`;

  const hasMarkerEnd = direction !== 'undirected';
  const hasMarkerStart = direction === 'bidirectional';

  const textStyleObj = storeEdge ? { ...DEFAULT_EDGE_TEXT_STYLE, ...storeEdge.textStyle } : DEFAULT_EDGE_TEXT_STYLE;
  const edgeTextStyle: React.CSSProperties = {
    fontSize: `${textStyleObj.fontSize}px`,
    fontWeight: textStyleObj.bold ? 'bold' : 'normal',
    fontStyle: textStyleObj.italic ? 'italic' : 'normal',
    color: textStyleObj.color ?? '#4b5563',
  };

  return (
    <>
      {/* Self-contained SVG markers for this edge */}
      <defs>
        {hasMarkerEnd && <ArrowMarker id={markerEndId} color={color} />}
        {hasMarkerStart && <ArrowMarker id={markerStartId} color={color} />}
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
