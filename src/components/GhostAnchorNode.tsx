import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export const GhostAnchorNode = ({ selected, data }: NodeProps) => {
  const type = (data.endpointType as 'from' | 'to') || 'from';
  
  return (
    <div
      className={`ghost-anchor-node ${selected ? 'ghost-anchor-selected' : ''}`}
      style={{
        width: '12px',
        height: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle
        type={type === 'from' ? 'source' : 'target'}
        position={Position.Top}
        id="handle"
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: '#8b5cf6',
          border: '2px solid #ffffff',
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
