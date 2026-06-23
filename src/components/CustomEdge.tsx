import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

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

  const isDotted = storeEdge?.style === 'dotted';
  const edgeStyle = {
    ...style,
    strokeDasharray: isDotted ? '5,5' : undefined,
    strokeWidth: selected ? 3 : 2,
    stroke: selected ? '#8b5cf6' : '#4b5563', // Indigo/violet when selected
    transition: 'stroke 0.2s, stroke-width 0.2s',
  };

  return (
    <>
      <BaseEdge path={edgePath} style={edgeStyle} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="edge-label-container"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
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
