import React, { useState } from 'react';
import { Handle, Position, type NodeProps, useConnection } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import type { NodeShape } from '../core/types';

export const CustomNode = ({ id, selected, data }: NodeProps) => {
  const label = (data.label as string) || '';
  const shape = (data.shape as NodeShape) || 'process';
  
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(label);

  const connection = useConnection();
  const isConnecting = connection.inProgress;
  const connectingClass = isConnecting ? 'is-connecting' : '';

  const handleStartEditing = () => {
    setTempLabel(label);
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    updateNodeLabel(id, tempLabel.trim() || label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEditing();
    }
    if (e.key === 'Escape') {
      setTempLabel(label);
      setIsEditing(false);
    }
  };

  // Node inner label text
  const renderInner = () => {
    if (isEditing) {
      return (
        <input
          type="text"
          value={tempLabel}
          onChange={(e) => setTempLabel(e.target.value)}
          onBlur={handleFinishEditing}
          onKeyDown={handleKeyDown}
          autoFocus
          className="node-input"
        />
      );
    }

    return (
      <div 
        className="node-label" 
        onDoubleClick={handleStartEditing}
        title="Double-cliquer pour modifier le label"
      >
        {label || 'Double-clic...'}
      </div>
    );
  };

  // Four handles for flexible connections (each side has both target and source)
  const renderHandles = () => (
    <>
      <Handle type="target" position={Position.Top} id="t-target" className="node-handle" />
      <Handle type="source" position={Position.Top} id="t-source" className="node-handle" />
      
      <Handle type="target" position={Position.Bottom} id="b-target" className="node-handle" />
      <Handle type="source" position={Position.Bottom} id="b-source" className="node-handle" />
      
      <Handle type="target" position={Position.Left} id="l-target" className="node-handle" />
      <Handle type="source" position={Position.Left} id="l-source" className="node-handle" />
      
      <Handle type="target" position={Position.Right} id="r-target" className="node-handle" />
      <Handle type="source" position={Position.Right} id="r-source" className="node-handle" />
    </>
  );

  // Selection bounding box overlay
  const renderSelectionOverlay = () => {
    if (!selected) return null;
    return (
      <div className="node-selection-overlay">
        <div className="selection-handle top-left" />
        <div className="selection-handle top-right" />
        <div className="selection-handle bottom-left" />
        <div className="selection-handle bottom-right" />
      </div>
    );
  };

  if (shape === 'decision') {
    return (
      <div className={`decision-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`}>
        <div className="decision-bg"></div>
        <div className="decision-text">{renderInner()}</div>
        {renderHandles()}
        {renderSelectionOverlay()}
      </div>
    );
  }

  if (shape === 'event') {
    return (
      <div className={`event-circle ${selected ? 'node-selected' : ''} ${connectingClass}`}>
        <div className="event-inner">{renderInner()}</div>
        {renderHandles()}
        {renderSelectionOverlay()}
      </div>
    );
  }

  if (shape === 'endEvent') {
    return (
      <div className={`end-event-circle-outer ${selected ? 'node-selected' : ''} ${connectingClass}`}>
        <div className="end-event-circle-inner">
          <div className="event-inner">{renderInner()}</div>
        </div>
        {renderHandles()}
        {renderSelectionOverlay()}
      </div>
    );
  }

  if (shape === 'database') {
    return (
      <div className={`database-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`}>
        <div className="database-text">{renderInner()}</div>
        {renderHandles()}
        {renderSelectionOverlay()}
      </div>
    );
  }

  if (shape === 'file') {
    return (
      <div className={`file-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`}>
        {renderInner()}
        {renderHandles()}
        {renderSelectionOverlay()}
      </div>
    );
  }

  // process, rounded, stadium
  let shapeClass = 'shape-process';
  if (shape === 'rounded') shapeClass = 'shape-rounded';
  if (shape === 'stadium') shapeClass = 'shape-stadium';

  return (
    <div className={`custom-node ${shapeClass} ${selected ? 'node-selected' : ''} ${connectingClass}`}>
      {renderInner()}
      {renderHandles()}
      {renderSelectionOverlay()}
    </div>
  );
};
export default CustomNode;
