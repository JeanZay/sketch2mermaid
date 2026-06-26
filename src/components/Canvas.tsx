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
  MarkerType,
  type Node,
  SelectionMode
} from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import TextBoxNode from './TextBoxNode';
import { useVirtualEdgeAnchors } from '../hooks/useVirtualEdgeAnchors';
import { VirtualAnchorsContext } from './VirtualAnchorsContext';
import GhostAnchorNode from './GhostAnchorNode';
import { USE_LASSO_SELECTION } from '../core/config';

const nodeTypes = {
  customNode: CustomNode,
  textBox: TextBoxNode,
  ghostAnchor: GhostAnchorNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

function FlowInner() {
  const diagram = useDiagramStore((state) => state.diagram);
  const addNode = useDiagramStore((state) => state.addNode);
  const updateNodePosition = useDiagramStore((state) => state.updateNodePosition);
  const updateNodeSize = useDiagramStore((state) => state.updateNodeSize);
  const addEdge = useDiagramStore((state) => state.addEdge);
  const updateTextBoxPosition = useDiagramStore((state) => state.updateTextBoxPosition);
  const updateTextBoxSize = useDiagramStore((state) => state.updateTextBoxSize);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const startTransaction = useDiagramStore((state) => state.startTransaction);
  const commitTransaction = useDiagramStore((state) => state.commitTransaction);
  const deleteSelectedElements = useDiagramStore((state) => state.deleteSelectedElements);
  const moveDetachedEdgeEndpoint = useDiagramStore((state) => state.moveDetachedEdgeEndpoint);
  const reconnectDetachedEdgeEndpoint = useDiagramStore((state) => state.reconnectDetachedEdgeEndpoint);

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

    const ghostNodes: Node[] = [];
    for (const edge of diagram.edges) {
      if (edge.from.kind === 'detached') {
        ghostNodes.push({
          id: `ghostAnchor__${edge.id}__from`,
          type: 'ghostAnchor' as const,
          position: edge.from.point,
          data: {
            endpointType: 'from' as const,
            edgeId: edge.id,
          },
          selected: selectedNodeIds.has(`ghostAnchor__${edge.id}__from`),
        });
      }
      if (edge.to.kind === 'detached') {
        ghostNodes.push({
          id: `ghostAnchor__${edge.id}__to`,
          type: 'ghostAnchor' as const,
          position: edge.to.point,
          data: {
            endpointType: 'to' as const,
            edgeId: edge.id,
          },
          selected: selectedNodeIds.has(`ghostAnchor__${edge.id}__to`),
        });
      }
    }

    return [...diagramNodes, ...textBoxNodes, ...ghostNodes];
  }, [diagram.nodes, diagram.textBoxes, diagram.edges, selectedNodeIds, updateNodeSize, updateTextBoxSize]);

  // Derive React Flow edges from diagram store + selection state
  // Note: markers are rendered by CustomEdge directly from the Zustand store,
  // bypassing React Flow's marker resolution which has issues with undefined values.
  const rfEdges = useMemo(() => {
    return diagram.edges.map((edge) => {
      const isSelected = selectedEdgeIds.has(edge.id);
      const source = edge.from.kind === 'connected' ? edge.from.nodeId : `ghostAnchor__${edge.id}__from`;
      const target = edge.to.kind === 'connected' ? edge.to.nodeId : `ghostAnchor__${edge.id}__to`;
      const sourceHandle = edge.from.kind === 'connected' ? edge.from.handleId : undefined;
      const targetHandle = edge.to.kind === 'connected' ? edge.to.handleId : undefined;

      return {
        id: edge.id,
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        targetHandle: targetHandle ?? undefined,
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

  // Helper to capture actual rendered endpoint positions before deletion
  const getEdgeEndpointPosition = useCallback((edgeId: string, endpoint: 'from' | 'to') => {
    const anchor = virtualAnchors[edgeId];
    if (anchor) {
      return endpoint === 'from'
        ? { x: anchor.sourceX, y: anchor.sourceY }
        : { x: anchor.targetX, y: anchor.targetY };
    }

    const edge = diagram.edges.find((e) => e.id === edgeId);
    if (!edge) return { x: 0, y: 0 };

    const ep = endpoint === 'from' ? edge.from : edge.to;
    if (ep.kind !== 'connected') {
      return ep.point;
    }

    const node = diagram.nodes.find((n) => n.id === ep.nodeId);
    if (!node) return { x: 0, y: 0 };

    const width = node.width ?? 100;
    const height = node.height ?? 40;
    const handleId = ep.handleId;

    let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    if (handleId) {
      if (handleId.startsWith('t-')) side = 'top';
      else if (handleId.startsWith('b-')) side = 'bottom';
      else if (handleId.startsWith('l-')) side = 'left';
      else if (handleId.startsWith('r-')) side = 'right';
    }

    switch (side) {
      case 'top': return { x: node.position.x + width / 2, y: node.position.y };
      case 'bottom': return { x: node.position.x + width / 2, y: node.position.y + height };
      case 'left': return { x: node.position.x, y: node.position.y + height / 2 };
      case 'right': return { x: node.position.x + width, y: node.position.y + height / 2 };
    }
  }, [virtualAnchors, diagram]);

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
    const cascadeEdges = diagram.edges.filter((e) => {
      const fromId = e.from.kind === 'connected' ? e.from.nodeId : null;
      const toId = e.to.kind === 'connected' ? e.to.nodeId : null;
      return (
        ((fromId && selNodeIdSet.has(fromId)) || (toId && selNodeIdSet.has(toId))) &&
        !selEdgeIdSet.has(e.id)
      );
    });

    if (cascadeEdges.length === 0) {
      // No cascade edges — delete everything directly
      deleteSelectedElements({
        nodeIds: selNodeIds,
        edgeIds: selEdgeIds,
        textBoxIds: selTextBoxIds,
        connectedEdgeBehavior: 'delete',
      });
    } else {
      // At least one selected node has connected edges — ask for confirmation
      setPendingDelete({
        nodeIds: selNodeIds,
        textBoxIds: selTextBoxIds,
        edgeIds: selEdgeIds,
        cascadeEdgeCount: cascadeEdges.length,
      });
    }
  }, [selectedNodeIds, selectedEdgeIds, nodeTypeById, diagram.edges, deleteSelectedElements]);

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
    let edgeSelectionChanged = false;
    let nextEdgeSelected: Set<string> | null = null;

    for (const change of changes) {
      if (change.type === 'select') {
        const nType = nodeTypeById.get(change.id);
        if (nType === 'ghostAnchor') {
          if (change.selected) {
            const parts = change.id.split('__');
            const edgeId = parts[1];
            if (!nextEdgeSelected) {
              nextEdgeSelected = new Set(selectedEdgeIds);
            }
            nextEdgeSelected.add(edgeId);
            edgeSelectionChanged = true;
          }
          continue;
        }

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
        } else if (nType === 'ghostAnchor') {
          const parts = change.id.split('__');
          const edgeId = parts[1];
          const endpoint = parts[2] as 'from' | 'to';
          moveDetachedEdgeEndpoint({ edgeId, endpoint, point: change.position });
        } else {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    }
    if (selectionChanged && nextSelected) {
      setSelectedNodeIds(nextSelected);
    }
    if (edgeSelectionChanged && nextEdgeSelected) {
      setSelectedEdgeIds(nextEdgeSelected);
    }
  }, [selectedNodeIds, selectedEdgeIds, updateNodePosition, updateTextBoxPosition, moveDetachedEdgeEndpoint, nodeTypeById]);

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

  // Helper to normalize the handle ID to the correct type for the endpoint
  const normalizeHandle = useCallback((endpoint: 'from' | 'to', handleId: string | null) => {
    if (!handleId) return null;
    const side = handleId.split('-')[0]; // 't', 'b', 'l', 'r'
    if (endpoint === 'from') return `${side}-source`;
    if (endpoint === 'to') return `${side}-target`;
    return handleId;
  }, []);

  // Handle edge connections and reconnection
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      const isSourceGhost = connection.source.startsWith('ghostAnchor__');
      const isTargetGhost = connection.target.startsWith('ghostAnchor__');

      if (isSourceGhost && isTargetGhost) {
        // Ghost-to-ghost connection is not supported; ignore to prevent phantom edges
        return;
      }

      if (isSourceGhost || isTargetGhost) {
        if (isSourceGhost && !isTargetGhost) {
          const parts = connection.source.split('__');
          const edgeId = parts[1];
          const endpoint = parts[2] as 'from' | 'to';
          reconnectDetachedEdgeEndpoint({
            edgeId,
            endpoint,
            nodeId: connection.target,
            handleId: normalizeHandle(endpoint, connection.targetHandle ?? null),
          });
        } else if (!isSourceGhost && isTargetGhost) {
          const parts = connection.target.split('__');
          const edgeId = parts[1];
          const endpoint = parts[2] as 'from' | 'to';
          reconnectDetachedEdgeEndpoint({
            edgeId,
            endpoint,
            nodeId: connection.source,
            handleId: normalizeHandle(endpoint, connection.sourceHandle ?? null),
          });
        }
      } else {
        addEdge(
          connection.source,
          connection.target,
          'solid',
          connection.sourceHandle ?? undefined,
          connection.targetHandle ?? undefined
        );
      }
    }
  }, [addEdge, reconnectDetachedEdgeEndpoint, normalizeHandle]);

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

  const lassoSelectionProps = USE_LASSO_SELECTION
    ? {
        selectionOnDrag: true,
        selectionMode: SelectionMode.Partial,
        panOnDrag: [1, 2] as [1, 2],
        panActivationKeyCode: 'Space',
        multiSelectionKeyCode: 'Shift',
      }
    : {};

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
          {...lassoSelectionProps}
        >
          <Background color="#374151" gap={16} />
          <Controls showInteractive={false} className="rf-controls" />

        </ReactFlow>

        {pendingDelete && (
          <ConfirmModal
            title="Supprimer"
            message={pendingDeleteMessage}
            confirmLabel="Supprimer aussi les flèches"
            cancelLabel="Annuler"
            middleLabel="Conserver les flèches sur le canvas"
            variant="danger"
            onConfirm={() => {
              deleteSelectedElements({
                nodeIds: pendingDelete.nodeIds,
                edgeIds: pendingDelete.edgeIds,
                textBoxIds: pendingDelete.textBoxIds,
                connectedEdgeBehavior: 'delete',
              });
              setPendingDelete(null);
            }}
            onMiddle={() => {
              const endpointPositions: Record<string, {
                from?: { x: number; y: number };
                to?: { x: number; y: number };
              }> = {};
              
              const selNodeIdSet = new Set(pendingDelete.nodeIds);
              const selEdgeIdSet = new Set(pendingDelete.edgeIds);
              const connectedEdges = diagram.edges.filter((e) => {
                const fromId = e.from.kind === 'connected' ? e.from.nodeId : null;
                const toId = e.to.kind === 'connected' ? e.to.nodeId : null;
                return (
                  ((fromId && selNodeIdSet.has(fromId)) || (toId && selNodeIdSet.has(toId))) &&
                  !selEdgeIdSet.has(e.id)
                );
              });

              for (const edge of connectedEdges) {
                const fromId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
                const toId = edge.to.kind === 'connected' ? edge.to.nodeId : null;
                
                endpointPositions[edge.id] = {};
                if (fromId && selNodeIdSet.has(fromId)) {
                  endpointPositions[edge.id].from = getEdgeEndpointPosition(edge.id, 'from');
                }
                if (toId && selNodeIdSet.has(toId)) {
                  endpointPositions[edge.id].to = getEdgeEndpointPosition(edge.id, 'to');
                }
              }

              deleteSelectedElements({
                nodeIds: pendingDelete.nodeIds,
                edgeIds: pendingDelete.edgeIds,
                textBoxIds: pendingDelete.textBoxIds,
                connectedEdgeBehavior: 'detach',
                endpointPositions,
              });
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
