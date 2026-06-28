import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export const GhostAnchorNode = ({ selected, data }: NodeProps) => {
  const type = (data.endpointType as 'from' | 'to') || 'from';
  const edgeSelected = !!data.edgeSelected;
  const isInteractive = selected || edgeSelected;

  // Subtle gray when idle, purple when selected/interactive
  const handleColor = isInteractive ? '#8b5cf6' : '#9ca3af';
  const handleBorder = isInteractive ? '2px solid #ffffff' : '2px solid #e5e7eb';

  return (
    <div
      className={`ghost-anchor-node ${selected ? 'ghost-anchor-selected' : ''}`}
      style={{
        width: '12px',
        height: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
    >
      <Handle
        type={type === 'from' ? 'source' : 'target'}
        position={Position.Top}
        id="handle"
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: handleColor,
          border: handleBorder,
          borderRadius: '50%',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
};

export default GhostAnchorNode;
