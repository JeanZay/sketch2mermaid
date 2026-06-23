import React, { useCallback, useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useReactFlow, 
  useNodes,
  type Connection,
  type NodeChange
} from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

const nodeTypes = {
  customNode: CustomNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

function FlowInner() {
  const diagram = useDiagramStore((state) => state.diagram);
  const addNode = useDiagramStore((state) => state.addNode);
  const updateNodePosition = useDiagramStore((state) => state.updateNodePosition);
  const deleteNode = useDiagramStore((state) => state.deleteNode);
  const addEdge = useDiagramStore((state) => state.addEdge);
  const deleteEdge = useDiagramStore((state) => state.deleteEdge);

  const { screenToFlowPosition } = useReactFlow();
  const nodes = useNodes();

  // Handle keyboard nudging with safeguards
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isEditable = activeEl.hasAttribute('contenteditable') && activeEl.getAttribute('contenteditable') !== 'false';
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          isEditable
        ) {
          return;
        }
      }

      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
      if (!isArrowKey) return;

      const selectedNode = nodes.find((n) => n.selected);
      if (!selectedNode) return;

      event.preventDefault();

      const step = event.shiftKey ? 10 : 2;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowUp') dy = -step;
      if (event.key === 'ArrowDown') dy = step;
      if (event.key === 'ArrowLeft') dx = -step;
      if (event.key === 'ArrowRight') dx = step;

      const currentPos = selectedNode.position;
      updateNodePosition(selectedNode.id, currentPos.x + dx, currentPos.y + dy);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, updateNodePosition]);

  // Map canonical nodes to React Flow nodes format
  const rfNodes = useMemo(() => {
    return diagram.nodes.map((node) => ({
      id: node.id,
      type: 'customNode',
      position: node.position,
      data: { label: node.label, shape: node.shape },
    }));
  }, [diagram.nodes]);

  // Map canonical edges to React Flow edges format
  const rfEdges = useMemo(() => {
    return diagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: 'customEdge',
    }));
  }, [diagram.edges]);

  // Handle node dragging
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        updateNodePosition(change.id, change.position.x, change.position.y);
      }
    });
  }, [updateNodePosition]);

  // Handle edge connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      addEdge(connection.source, connection.target);
    }
  }, [addEdge]);

  // Double-clicking the background pane creates a new process node
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('react-flow__pane')) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode('process', position.x, position.y);
    }
  }, [addNode, screenToFlowPosition]);

  return (
    <div className="canvas-container" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onPaneDoubleClick={onPaneDoubleClick}
        onNodesDelete={(nodes) => nodes.forEach((n) => deleteNode(n.id))}
        onEdgesDelete={(edges) => edges.forEach((e) => deleteEdge(e.id))}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
      >
        <Background color="#374151" gap={16} />
        <Controls showInteractive={false} className="rf-controls" />
        <MiniMap 
          nodeColor={() => '#1f2937'} 
          maskColor="rgba(11, 15, 25, 0.6)" 
          className="rf-minimap"
        />
      </ReactFlow>
    </div>
  );
}

export const Canvas = () => {
  return <FlowInner />;
};

export default Canvas;
