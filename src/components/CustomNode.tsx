import React, { useState } from 'react';
import { Handle, Position, type NodeProps, useConnection, NodeResizer } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import type { NodeShape } from '../core/types';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';
import { computeNodeFontSize } from '../core/nodeText';

export const CustomNode = ({ id, selected, data }: NodeProps) => {
  const label = (data.label as string) || '';
  const shape = (data.shape as NodeShape) || 'process';
  const nodeWidth = (data.width as number | undefined);
  const nodeHeight = (data.height as number | undefined);
  const updateNodeSize = data.updateNodeSize as ((id: string, w: number, h: number) => void) | undefined;
  
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(label);

  const connection = useConnection();
  const isConnecting = connection.inProgress;
  const connectingClass = isConnecting ? 'is-connecting' : '';

  // Resolve dimensions from data or config defaults
  const sizeConfig = NODE_SIZE_DEFAULTS[shape];
  const width = nodeWidth ?? sizeConfig.width;
  const height = nodeHeight ?? sizeConfig.height;

  // Compute auto-fit font size
  const fontSize = computeNodeFontSize({ label, width, height });

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

  const handleResizeEnd = (_event: unknown, params: { width: number; height: number }) => {
    updateNodeSize?.(id, params.width, params.height);
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
          style={{ fontSize }}
        />
      );
    }

    return (
      <div 
        className="node-label" 
        onDoubleClick={handleStartEditing}
        title={label}
        style={{ fontSize }}
      >
        {label || 'Double-clic...'}
      </div>
    );
  };

  // NodeResizer — visible only when selected
  const renderResizer = () => (
    <NodeResizer
      isVisible={!!selected}
      minWidth={sizeConfig.minWidth}
      minHeight={sizeConfig.minHeight}
      keepAspectRatio={shape === 'event' || shape === 'endEvent'}
      onResizeEnd={handleResizeEnd}
      lineClassName="node-resize-line"
      handleClassName="node-resize-handle"
    />
  );

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

  if (shape === 'decision') {
    return (
      <div className={`decision-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
        {renderResizer()}
        <div className="decision-bg"></div>
        <div className="decision-text">{renderInner()}</div>
        {renderHandles()}
      </div>
    );
  }

  if (shape === 'event') {
    return (
      <div className={`event-circle ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
        {renderResizer()}
        <div className="event-inner">{renderInner()}</div>
        {renderHandles()}
      </div>
    );
  }

  if (shape === 'endEvent') {
    return (
      <div className={`end-event-circle-outer ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
        {renderResizer()}
        <div className="end-event-circle-inner">
          <div className="event-inner">{renderInner()}</div>
        </div>
        {renderHandles()}
      </div>
    );
  }

  if (shape === 'database') {
    return (
      <div className={`database-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
        {renderResizer()}
        <div className="database-text">{renderInner()}</div>
        {renderHandles()}
      </div>
    );
  }

  if (shape === 'file') {
    return (
      <div className={`file-wrapper ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
        {renderResizer()}
        {renderInner()}
        {renderHandles()}
      </div>
    );
  }

  // process, rounded, stadium
  let shapeClass = 'shape-process';
  if (shape === 'rounded') shapeClass = 'shape-rounded';
  if (shape === 'stadium') shapeClass = 'shape-stadium';

  return (
    <div className={`custom-node ${shapeClass} ${selected ? 'node-selected' : ''} ${connectingClass}`} style={{ width, height }}>
      {renderResizer()}
      {renderInner()}
      {renderHandles()}
    </div>
  );
};
export default CustomNode;
