import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { 
  ReactFlow, 
  Background, 
  Controls, 
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
import { useVirtualEdgeAnchors } from '../hooks/useVirtualEdgeAnchors';
import { VirtualAnchorsContext } from './VirtualAnchorsContext';

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
  const updateNodeSize = useDiagramStore((state) => state.updateNodeSize);
  const deleteNode = useDiagramStore((state) => state.deleteNode);
  const addEdge = useDiagramStore((state) => state.addEdge);
  const deleteEdge = useDiagramStore((state) => state.deleteEdge);
  const updateTextBoxPosition = useDiagramStore((state) => state.updateTextBoxPosition);
  const updateTextBoxSize = useDiagramStore((state) => state.updateTextBoxSize);
  const deleteTextBox = useDiagramStore((state) => state.deleteTextBox);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const startTransaction = useDiagramStore((state) => state.startTransaction);
  const commitTransaction = useDiagramStore((state) => state.commitTransaction);

  const { screenToFlowPosition } = useReactFlow();

  // Compute virtual anchor positions for edge distribution
  const virtualAnchors = useVirtualEdgeAnchors();

  // Selection state — updated only from event handler callbacks (not effects)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  // Pending delete confirmation state for nodes with connected edges
  const [pendingDelete, setPendingDelete] = useState<{
    nodeIds: string[];
    textBoxIds: string[];
    edgeIds: string[];       // edges explicitly selected by the user
    cascadeEdgeCount: number; // additional edges connected to selected nodes
  } | null>(null);

  // Derive React Flow nodes from diagram store + selection state
  const rfNodes = useMemo(() => {
    const diagramNodes = diagram.nodes.map((node) => ({
      id: node.id,
      type: 'customNode' as const,
      position: node.position,
      data: {
        label: node.label,
        shape: node.shape,
        width: node.width,
        height: node.height,
        style: node.style,
        updateNodeSize,
      },
      selected: selectedNodeIds.has(node.id),
    }));

    const textBoxNodes = diagram.textBoxes.map((tb) => ({
      id: tb.id,
      type: 'textBox' as const,
      position: tb.position,
      data: {
        text: tb.text,
        style: tb.style,
        width: tb.width,
        height: tb.height,
        updateTextBoxSize,
      },
      selected: selectedNodeIds.has(tb.id),
      connectable: false,
    }));

    return [...diagramNodes, ...textBoxNodes];
  }, [diagram.nodes, diagram.textBoxes, selectedNodeIds, updateNodeSize, updateTextBoxSize]);

  // Derive React Flow edges from diagram store + selection state
  // Note: markers are rendered by CustomEdge directly from the Zustand store,
  // bypassing React Flow's marker resolution which has issues with undefined values.
  const rfEdges = useMemo(() => {
    return diagram.edges.map((edge) => {
      const isSelected = selectedEdgeIds.has(edge.id);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: 'customEdge',
        selected: isSelected,
      };
    });
  }, [diagram.edges, selectedEdgeIds]);

  // Access React Flow's internal node list for keyboard nudging
  const nodes = useNodes();

  // Build a lookup for node types from the current rfNodes to route changes
  // by React Flow node type (refinement #1: avoid scattering ID prefix checks)
  const nodeTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of rfNodes) {
      map.set(n.id, n.type);
    }
    return map;
  }, [rfNodes]);

  // Centralized delete handler: collects all selected elements, checks for
  // connected edges on selected nodes, and either deletes directly or shows
  // a confirmation dialog. Handles mixed selection atomically.
  const handleDeleteSelected = useCallback(() => {
    // Partition selected nodes into diagram nodes vs text boxes
    const selNodeIds: string[] = [];
    const selTextBoxIds: string[] = [];
    for (const id of selectedNodeIds) {
      const nType = nodeTypeById.get(id);
      if (nType === 'textBox') {
        selTextBoxIds.push(id);
      } else if (nType === 'customNode') {
        selNodeIds.push(id);
      }
    }
    const selEdgeIds = Array.from(selectedEdgeIds);

    // Nothing selected — bail
    if (selNodeIds.length === 0 && selTextBoxIds.length === 0 && selEdgeIds.length === 0) return;

    // Count edges connected to the selected nodes (unique, excluding already-selected edges)
    const selNodeIdSet = new Set(selNodeIds);
    const selEdgeIdSet = new Set(selEdgeIds);
    const cascadeEdges = diagram.edges.filter(
      (e) => (selNodeIdSet.has(e.from) || selNodeIdSet.has(e.to)) && !selEdgeIdSet.has(e.id)
    );

    if (cascadeEdges.length === 0) {
      // No cascade edges — delete everything directly
      startTransaction();
      for (const id of selEdgeIds) deleteEdge(id);
      for (const id of selTextBoxIds) deleteTextBox(id);
      for (const id of selNodeIds) deleteNode(id);
      commitTransaction();
    } else {
      // At least one selected node has connected edges — ask for confirmation
      setPendingDelete({
        nodeIds: selNodeIds,
        textBoxIds: selTextBoxIds,
        edgeIds: selEdgeIds,
        cascadeEdgeCount: cascadeEdges.length,
      });
    }
  }, [selectedNodeIds, selectedEdgeIds, nodeTypeById, diagram.edges, startTransaction, commitTransaction, deleteNode, deleteEdge, deleteTextBox]);

  // Handle keyboard nudging and undo/redo shortcuts with safeguards
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

      // Undo/Redo shortcuts
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (isMod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      // Cmd+Shift+Z (macOS redo)
      if (isMod && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      // Delete/Backspace — custom handling to intercept before React Flow
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteSelected();
        return;
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
  }, [nodes, updateNodePosition, undo, redo, handleDeleteSelected]);


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

  // Build the confirmation message based on the pending delete state
  const pendingDeleteMessage = useMemo(() => {
    if (!pendingDelete) return '';
    const { nodeIds, cascadeEdgeCount } = pendingDelete;
    if (nodeIds.length === 1) {
      return `Ce nœud est connecté à ${cascadeEdgeCount} liaison(s). Supprimer ce nœud supprimera aussi ces liaisons.`;
    }
    return `Ces ${nodeIds.length} nœuds sont connectés à ${cascadeEdgeCount} liaison(s) au total. Supprimer ces nœuds supprimera aussi ces liaisons.`;
  }, [pendingDelete]);

  return (
    <VirtualAnchorsContext.Provider value={virtualAnchors}>
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
          onNodeDragStart={startTransaction}
          onNodeDragStop={commitTransaction}
          // Neutralized: all deletion is handled by our custom keydown handler
          // to enforce the confirmation dialog for nodes with connected edges.
          onNodesDelete={() => {}}
          onEdgesDelete={() => {}}
          deleteKeyCode={null}
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

        </ReactFlow>

        {pendingDelete && (
          <ConfirmModal
            title="Supprimer"
            message={pendingDeleteMessage}
            confirmLabel="Supprimer tout"
            cancelLabel="Annuler"
            variant="danger"
            onConfirm={() => {
              startTransaction();
              for (const id of pendingDelete.edgeIds) deleteEdge(id);
              for (const id of pendingDelete.textBoxIds) deleteTextBox(id);
              for (const id of pendingDelete.nodeIds) deleteNode(id);
              commitTransaction();
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </VirtualAnchorsContext.Provider>
  );
}

export const Canvas = () => {
  return <FlowInner />;
};

export default Canvas;
