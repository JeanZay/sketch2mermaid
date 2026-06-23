import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useReactFlow, 
  useNodes,
  type Connection,
  type NodeChange,
  type EdgeChange,
  MarkerType
} from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import TextBoxNode from './TextBoxNode';

const nodeTypes = {
  customNode: CustomNode,
  textBox: TextBoxNode,
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
  const updateTextBoxPosition = useDiagramStore((state) => state.updateTextBoxPosition);
  const deleteTextBox = useDiagramStore((state) => state.deleteTextBox);

  const { screenToFlowPosition } = useReactFlow();

  // Selection state — updated only from event handler callbacks (not effects)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  // Derive React Flow nodes from diagram store + selection state
  const rfNodes = useMemo(() => {
    const diagramNodes = diagram.nodes.map((node) => ({
      id: node.id,
      type: 'customNode' as const,
      position: node.position,
      data: { label: node.label, shape: node.shape },
      selected: selectedNodeIds.has(node.id),
    }));

    const textBoxNodes = diagram.textBoxes.map((tb) => ({
      id: tb.id,
      type: 'textBox' as const,
      position: tb.position,
      data: { text: tb.text, style: tb.style },
      selected: selectedNodeIds.has(tb.id),
      connectable: false,
    }));

    return [...diagramNodes, ...textBoxNodes];
  }, [diagram.nodes, diagram.textBoxes, selectedNodeIds]);

  // Derive React Flow edges from diagram store + selection state
  const rfEdges = useMemo(() => {
    return diagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      type: 'customEdge',
      selected: selectedEdgeIds.has(edge.id),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: selectedEdgeIds.has(edge.id) ? '#8b5cf6' : '#4b5563',
      },
    }));
  }, [diagram.edges, selectedEdgeIds]);

  // Access React Flow's internal node list for keyboard nudging
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

  // Build a lookup for node types from the current rfNodes to route changes
  // by React Flow node type (refinement #1: avoid scattering ID prefix checks)
  const nodeTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of rfNodes) {
      map.set(n.id, n.type);
    }
    return map;
  }, [rfNodes]);

  // Handle ALL node changes — selection tracked in state, position updated continuously
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let selectionChanged = false;
    let nextSelected: Set<string> | null = null;
    for (const change of changes) {
      if (change.type === 'select') {
        if (!nextSelected) {
          nextSelected = new Set(selectedNodeIds);
        }
        if (change.selected) {
          nextSelected.add(change.id);
        } else {
          nextSelected.delete(change.id);
        }
        selectionChanged = true;
      } else if (change.type === 'position' && change.position) {
        const nType = nodeTypeById.get(change.id);
        if (nType === 'textBox') {
          updateTextBoxPosition(change.id, change.position.x, change.position.y);
        } else {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    }
    if (selectionChanged && nextSelected) {
      setSelectedNodeIds(nextSelected);
    }
  }, [selectedNodeIds, updateNodePosition, updateTextBoxPosition, nodeTypeById]);

  // Handle ALL edge changes — selection tracked in state
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    let selectionChanged = false;
    let nextSelected: Set<string> | null = null;
    for (const change of changes) {
      if (change.type === 'select') {
        if (!nextSelected) {
          nextSelected = new Set(selectedEdgeIds);
        }
        if (change.selected) {
          nextSelected.add(change.id);
        } else {
          nextSelected.delete(change.id);
        }
        selectionChanged = true;
      }
    }
    if (selectionChanged && nextSelected) {
      setSelectedEdgeIds(nextSelected);
    }
  }, [selectedEdgeIds]);

  // Handle edge connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      addEdge(
        connection.source,
        connection.target,
        'solid',
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );
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
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneDoubleClick={onPaneDoubleClick}
        onNodesDelete={(deletedNodes) => {
          for (const n of deletedNodes) {
            const nType = nodeTypeById.get(n.id);
            if (nType === 'textBox') {
              deleteTextBox(n.id);
            } else {
              deleteNode(n.id);
            }
          }
        }}
        onEdgesDelete={(edges) => edges.forEach((e) => deleteEdge(e.id))}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeDragThreshold={2}
        defaultEdgeOptions={{ interactionWidth: 20 }}
        connectionLineOptions={{
          style: { stroke: '#4b5563', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#4b5563',
          },
        }}
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


