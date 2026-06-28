import React, { useState, useRef, useEffect } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import { MIN_GROUP_WIDTH, MIN_GROUP_HEIGHT } from '../core/config';

import type { GroupStyle } from '../core/types';

export const GroupNode = ({ id, selected, data }: NodeProps) => {
  const label = (data.label as string) || '';
  const kind = (data.kind as 'subgraph' | 'lane') || 'subgraph';
  const width = (data.width as number) ?? 300;
  const height = (data.height as number) ?? 200;

  const direction = useDiagramStore((state) => state.diagram.direction);
  const updateGroupLabel = useDiagramStore((state) => state.updateGroupLabel);
  const updateGroupSize = useDiagramStore((state) => state.updateGroupSize);
  const startTransaction = useDiagramStore((state) => state.startTransaction);
  const commitTransaction = useDiagramStore((state) => state.commitTransaction);

  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempLabel(label);
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    updateGroupLabel(id, tempLabel.trim() || label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleFinishEditing();
    }
    if (e.key === 'Escape') {
      setTempLabel(label);
      setIsEditing(false);
    }
  };

  const handleResize = (_event: unknown, params: { width: number; height: number }) => {
    updateGroupSize(id, params.width, params.height);
  };

  const isHorizontalLane = kind === 'lane' && (direction === 'LR' || direction === 'RL');

  const customStyle = (data.style as GroupStyle | undefined) || {};
  const containerStyle: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    ...(customStyle.backgroundColor ? { backgroundColor: customStyle.backgroundColor } : {}),
    ...(customStyle.borderColor ? { borderColor: customStyle.borderColor } : {}),
    ...(customStyle.textColor ? { color: customStyle.textColor } : {}),
  };

  const labelStyle: React.CSSProperties = {
    ...(customStyle.textColor ? { color: customStyle.textColor } : {}),
  };

  return (
    <div
      className={`group-node group-node-${kind} ${selected ? 'group-node-selected' : ''} ${
        isHorizontalLane ? 'group-node-horizontal-lane' : 'group-node-vertical'
      }`}
      style={containerStyle}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={MIN_GROUP_WIDTH}
        minHeight={MIN_GROUP_HEIGHT}
        keepAspectRatio={false}
        onResizeStart={startTransaction}
        onResize={handleResize}
        onResizeEnd={commitTransaction}
        lineClassName="node-resize-line"
        handleClassName="node-resize-handle"
      />

      <div className="group-node-title-area" onDoubleClick={handleStartEditing}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDown}
            className="group-node-input nodrag nopan"
          />
        ) : (
          <span className="group-node-label" style={labelStyle} title="Double-click to edit">
            {label || (kind === 'lane' ? 'Swimlane' : 'Group')}
          </span>
        )}
      </div>

      <div className="group-node-body-area" />
    </div>
  );
};

export default GroupNode;
