import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
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
import { USE_LASSO_SELECTION, USE_GROUPS_AND_SWIMLANES, GROUP_MEMBERSHIP_TOLERANCE, SNAP_THRESHOLD } from '../core/config';
import { findNearestHandle, getEdgeEndpointPosition } from '../utils/edgeSnapping';
import { collectSelectionInput } from '../utils/selectionHelpers';
import GroupNode from './GroupNode';
import type { DiagramGroup } from '../core/types';

const nodeTypes = {
  customNode: CustomNode,
  textBox: TextBoxNode,
  ghostAnchor: GhostAnchorNode,
  groupNode: GroupNode,
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
  const updateGroupPosition = useDiagramStore((state) => state.updateGroupPosition);
  const assignNodeToGroup = useDiagramStore((state) => state.assignNodeToGroup);

  const activeTool = useDiagramStore((state) => state.activeTool);
  const setActiveTool = useDiagramStore((state) => state.setActiveTool);
  const copySelection = useDiagramStore((state) => state.copySelection);
  const pasteSelection = useDiagramStore((state) => state.pasteSelection);
  const copiedSelection = useDiagramStore((state) => state.copiedSelection);

  // Retrieve and update selection via Zustand store
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDiagramStore((state) => state.selectedEdgeIds);
  const setSelectedNodeIds = useDiagramStore((state) => state.setSelectedNodeIds);
  const setSelectedEdgeIds = useDiagramStore((state) => state.setSelectedEdgeIds);

  const { screenToFlowPosition } = useReactFlow();

  // Compute virtual anchor positions for edge distribution
  const virtualAnchors = useVirtualEdgeAnchors();

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Track ghost anchor connection drags for detach-on-drop-in-empty-space
  const ghostConnectRef = useRef<{
    edgeId: string;
    endpoint: 'from' | 'to';
    connected: boolean; // set to true if onConnect fires for this drag
  } | null>(null);

  // Transient arrow creation state
  const [draftStart, setDraftStart] = useState<{
    x: number;
    y: number;
    endpoint: import('../core/types').DiagramEdgeEndpoint;
  } | null>(null);
  const [draftMousePos, setDraftMousePos] = useState<{ x: number; y: number } | null>(null);

  // Pending delete confirmation state for nodes with connected edges
  const [pendingDelete, setPendingDelete] = useState<{
    nodeIds: string[];
    textBoxIds: string[];
    edgeIds: string[];       // edges explicitly selected by the user
    groupIds?: string[];
    cascadeEdgeCount: number; // additional edges connected to selected nodes
  } | null>(null);

  // Pending delete confirmation state for visual groups
  const [pendingGroupDelete, setPendingGroupDelete] = useState<{
    groupIds: string[];
    nodeIds: string[];
    textBoxIds: string[];
    edgeIds: string[];
  } | null>(null);

  // Derive React Flow nodes from diagram store + selection state
  const rfNodes = useMemo(() => {
    const selectedNodesSet = new Set(selectedNodeIds);
    const selectedEdgesSet = new Set(selectedEdgeIds);

    const groupNodes = USE_GROUPS_AND_SWIMLANES && diagram.groups
      ? diagram.groups.map((group) => ({
          id: group.id,
          type: 'groupNode' as const,
          position: group.position,
          data: {
            label: group.label,
            kind: group.kind,
            width: group.width,
            height: group.height,
          },
          selected: selectedNodesSet.has(group.id),
        }))
      : [];

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
      selected: selectedNodesSet.has(node.id),
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
      selected: selectedNodesSet.has(tb.id),
      connectable: false,
    }));

    const ghostNodes: Node[] = [];
    for (const edge of diagram.edges) {
      const isEdgeSelected = selectedEdgesSet.has(edge.id);

      if (edge.from.kind === 'detached' || isEdgeSelected) {
        const position = edge.from.kind === 'connected'
          ? getEdgeEndpointPosition(edge.id, 'from', diagram)
          : edge.from.point;
        ghostNodes.push({
          id: `ghostAnchor__${edge.id}__from`,
          type: 'ghostAnchor' as const,
          position: position,
          data: {
            endpointType: 'from' as const,
            edgeId: edge.id,
            edgeSelected: isEdgeSelected,
          },
          selected: selectedNodesSet.has(`ghostAnchor__${edge.id}__from`),
        });
      }

      if (edge.to.kind === 'detached' || isEdgeSelected) {
        const position = edge.to.kind === 'connected'
          ? getEdgeEndpointPosition(edge.id, 'to', diagram)
          : edge.to.point;
        ghostNodes.push({
          id: `ghostAnchor__${edge.id}__to`,
          type: 'ghostAnchor' as const,
          position: position,
          data: {
            endpointType: 'to' as const,
            edgeId: edge.id,
            edgeSelected: isEdgeSelected,
          },
          selected: selectedNodesSet.has(`ghostAnchor__${edge.id}__to`),
        });
      }
    }

    if (draftStart && draftMousePos) {
      if (draftStart.endpoint.kind === 'detached') {
        ghostNodes.push({
          id: 'draft-start-temp-node',
          type: 'ghostAnchor' as const,
          position: draftStart.endpoint.point,
          data: {
            endpointType: 'from' as const,
            edgeId: 'draft-preview',
            edgeSelected: true,
          },
          selected: false,
        });
      }
      ghostNodes.push({
        id: 'draft-end-temp-node',
        type: 'ghostAnchor' as const,
        position: draftMousePos,
        data: {
          endpointType: 'to' as const,
          edgeId: 'draft-preview',
          edgeSelected: true,
        },
        selected: false,
      });
    }

    return [...groupNodes, ...diagramNodes, ...textBoxNodes, ...ghostNodes];
  }, [diagram, selectedNodeIds, selectedEdgeIds, updateNodeSize, updateTextBoxSize, draftStart, draftMousePos]);

  // Derive React Flow edges from diagram store + selection state
  // Note: markers are rendered by CustomEdge directly from the Zustand store,
  // bypassing React Flow's marker resolution which has issues with undefined values.
  const rfEdges = useMemo(() => {
    const selectedEdgesSet = new Set(selectedEdgeIds);
    const list = diagram.edges.map((edge) => {
      const isSelected = selectedEdgesSet.has(edge.id);
      const source = (edge.from.kind === 'connected' && !isSelected)
        ? edge.from.nodeId
        : `ghostAnchor__${edge.id}__from`;
      const target = (edge.to.kind === 'connected' && !isSelected)
        ? edge.to.nodeId
        : `ghostAnchor__${edge.id}__to`;
      const sourceHandle = (edge.from.kind === 'connected' && !isSelected)
        ? edge.from.handleId ?? undefined
        : undefined;
      const targetHandle = (edge.to.kind === 'connected' && !isSelected)
        ? edge.to.handleId ?? undefined
        : undefined;

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

    if (draftStart && draftMousePos) {
      const source = draftStart.endpoint.kind === 'connected' ? draftStart.endpoint.nodeId : 'draft-start-temp-node';
      const sourceHandle = draftStart.endpoint.kind === 'connected' ? draftStart.endpoint.handleId ?? undefined : undefined;
      list.push({
        id: 'draft-edge-preview',
        source,
        target: 'draft-end-temp-node',
        sourceHandle,
        targetHandle: undefined,
        label: '',
        type: 'customEdge',
        selected: false,
      });
    }

    return list;
  }, [diagram.edges, selectedEdgeIds, draftStart, draftMousePos]);

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


  const proceedWithDeletion = useCallback(({
    groupIds,
    nodeIds,
    textBoxIds,
    edgeIds,
    deleteChildren
  }: {
    groupIds: string[];
    nodeIds: string[];
    textBoxIds: string[];
    edgeIds: string[];
    deleteChildren: boolean;
  }) => {
    let targetNodeIds = [...nodeIds];
    if (deleteChildren && USE_GROUPS_AND_SWIMLANES) {
      const childrenIds: string[] = [];
      const collectDescendants = (gId: string) => {
        for (const n of diagram.nodes) {
          if (n.parentGroupId === gId) {
            childrenIds.push(n.id);
          }
        }
        const subgroups = (diagram.groups || []).filter((g) => g.parentGroupId === gId);
        for (const sub of subgroups) {
          collectDescendants(sub.id);
        }
      };
      for (const gId of groupIds) {
        collectDescendants(gId);
      }
      targetNodeIds = Array.from(new Set([...targetNodeIds, ...childrenIds]));
    }

    const selNodeIdSet = new Set(targetNodeIds);
    const selEdgeIdSet = new Set(edgeIds);
    
    const cascadeEdges = diagram.edges.filter((e) => {
      const fromId = e.from.kind === 'connected' ? e.from.nodeId : null;
      const toId = e.to.kind === 'connected' ? e.to.nodeId : null;
      return (
        ((fromId && selNodeIdSet.has(fromId)) || (toId && selNodeIdSet.has(toId))) &&
        !selEdgeIdSet.has(e.id)
      );
    });

    if (cascadeEdges.length === 0) {
      deleteSelectedElements({
        nodeIds: targetNodeIds,
        edgeIds,
        textBoxIds,
        groupIds,
        connectedEdgeBehavior: 'delete',
      });
    } else {
      setPendingDelete({
        nodeIds: targetNodeIds,
        textBoxIds,
        edgeIds,
        groupIds,
        cascadeEdgeCount: cascadeEdges.length,
      });
    }
  }, [diagram.nodes, diagram.edges, diagram.groups, deleteSelectedElements]);

  const handleDeleteSelected = useCallback(() => {
    const selNodeIds: string[] = [];
    const selTextBoxIds: string[] = [];
    const selGroupIds: string[] = [];
    for (const id of selectedNodeIds) {
      const nType = nodeTypeById.get(id);
      if (nType === 'textBox') {
        selTextBoxIds.push(id);
      } else if (nType === 'customNode') {
        selNodeIds.push(id);
      } else if (nType === 'groupNode') {
        selGroupIds.push(id);
      }
    }
    const selEdgeIds = Array.from(selectedEdgeIds);

    if (selNodeIds.length === 0 && selTextBoxIds.length === 0 && selEdgeIds.length === 0 && selGroupIds.length === 0) return;

    const hasNonEmptyGroup = USE_GROUPS_AND_SWIMLANES && selGroupIds.some((gId) => 
      diagram.nodes.some((n) => n.parentGroupId === gId)
    );

    if (hasNonEmptyGroup) {
      setPendingGroupDelete({
        groupIds: selGroupIds,
        nodeIds: selNodeIds,
        textBoxIds: selTextBoxIds,
        edgeIds: selEdgeIds,
      });
    } else {
      proceedWithDeletion({
        groupIds: selGroupIds,
        nodeIds: selNodeIds,
        textBoxIds: selTextBoxIds,
        edgeIds: selEdgeIds,
        deleteChildren: false
      });
    }
  }, [selectedNodeIds, selectedEdgeIds, nodeTypeById, diagram.nodes, proceedWithDeletion]);

  // Subscribe to pending edge selection requests from Toolbar
  useEffect(() => {
    return useDiagramStore.subscribe((state, prevState) => {
      if (state.pendingEdgeSelect && state.pendingEdgeSelect !== prevState.pendingEdgeSelect) {
        const edgeId = state.pendingEdgeSelect;
        setSelectedEdgeIds([edgeId]);
        setSelectedNodeIds([]);
        state.clearPendingEdgeSelect();
      }
    });
  }, [setSelectedNodeIds, setSelectedEdgeIds]);

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

      if (event.key === 'Escape' && activeTool === 'arrow') {
        event.preventDefault();
        setDraftStart(null);
        setDraftMousePos(null);
        setActiveTool('select');
        return;
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

      // Copy shortcut (Ctrl+C / Cmd+C)
      if (isMod && event.key.toLowerCase() === 'c') {
        const minimalNodes = Array.from(selectedNodeIds).map((id) => ({
          id,
          type: nodeTypeById.get(id),
        }));
        const { nodeIds, edgeIds, textBoxIds } = collectSelectionInput(
          minimalNodes,
          Array.from(selectedEdgeIds)
        );

        if (nodeIds.length > 0 || textBoxIds.length > 0 || edgeIds.length > 0) {
          event.preventDefault();
          copySelection({ nodeIds, edgeIds, textBoxIds });
        }
        return;
      }

      // Paste shortcut (Ctrl+V / Cmd+V)
      if (isMod && event.key.toLowerCase() === 'v') {
        if (copiedSelection) {
          event.preventDefault();
          pasteSelection();
        }
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
  }, [nodes, updateNodePosition, undo, redo, handleDeleteSelected, activeTool, setActiveTool, copySelection, pasteSelection, copiedSelection, selectedNodeIds, selectedEdgeIds, nodeTypeById]);


  // Handle ALL node changes — selection tracked in state, position updated continuously
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let selectionChanged = false;
    let nextSelected: Set<string> | null = null;
    let edgeSelectionChanged = false;
    let nextEdgeSelected: Set<string> | null = null;

    for (const change of changes) {
      if (change.type === 'select') {
        if (change.id.startsWith('ghostAnchor__') || change.id.startsWith('draft-')) {
          if (change.id.startsWith('ghostAnchor__') && change.selected) {
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
          if (parts.length >= 3) {
            const edgeId = parts[1];
            const endpoint = parts[2] as 'from' | 'to';
            moveDetachedEdgeEndpoint({ edgeId, endpoint, point: change.position });
          }
        } else if (nType === 'groupNode') {
          updateGroupPosition(change.id, change.position.x, change.position.y);
        } else {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    }
    if (selectionChanged && nextSelected) {
      setSelectedNodeIds(Array.from(nextSelected));
    }
    if (edgeSelectionChanged && nextEdgeSelected) {
      setSelectedEdgeIds(Array.from(nextEdgeSelected));
    }
  }, [selectedNodeIds, selectedEdgeIds, updateNodePosition, updateTextBoxPosition, moveDetachedEdgeEndpoint, updateGroupPosition, nodeTypeById, setSelectedNodeIds, setSelectedEdgeIds]);

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
      setSelectedEdgeIds(Array.from(nextSelected));
    }
  }, [selectedEdgeIds, setSelectedEdgeIds]);

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
        // Mark as connected so onConnectEnd won't detach
        if (ghostConnectRef.current) ghostConnectRef.current.connected = true;
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

  // Track connection starts from ghost anchor handles
  const onConnectStart = useCallback((_event: React.MouseEvent | React.TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) => {
    const nodeId = params.nodeId;
    if (!nodeId || !nodeId.startsWith('ghostAnchor__')) return;
    const parts = nodeId.split('__');
    if (parts.length < 3) return;
    const edgeId = parts[1];
    const endpoint = parts[2] as 'from' | 'to';
    // Only track if the endpoint is currently connected (so we can detach it)
    const edge = diagram.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const ep = endpoint === 'from' ? edge.from : edge.to;
    if (ep.kind !== 'connected') return;
    ghostConnectRef.current = { edgeId, endpoint, connected: false };
    // Start undo transaction for the potential detach
    startTransaction();
  }, [diagram.edges, startTransaction]);

  // When a connection from a ghost anchor ends without connecting, detach the endpoint
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const tracked = ghostConnectRef.current;
    ghostConnectRef.current = null;
    if (!tracked) return;
    if (tracked.connected) {
      // Successfully reconnected via onConnect — commit the transaction
      commitTransaction();
      return;
    }
    // Dropped in empty space — detach the endpoint
    const clientX = 'touches' in event ? event.changedTouches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.changedTouches[0].clientY : event.clientY;
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

    // First detach from the node, then snap if near another node
    moveDetachedEdgeEndpoint({ edgeId: tracked.edgeId, endpoint: tracked.endpoint, point: flowPos });

    const closest = findNearestHandle(flowPos, diagram.nodes);
    if (closest && closest.distance < SNAP_THRESHOLD) {
      const side = closest.handleId.split('-')[0];
      const targetHandle = tracked.endpoint === 'from' ? `${side}-source` : `${side}-target`;
      reconnectDetachedEdgeEndpoint({
        edgeId: tracked.edgeId,
        endpoint: tracked.endpoint,
        nodeId: closest.nodeId,
        handleId: targetHandle,
      });
    }
    commitTransaction();
  }, [screenToFlowPosition, moveDetachedEdgeEndpoint, reconnectDetachedEdgeEndpoint, commitTransaction, diagram.nodes]);

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (activeTool !== 'arrow') return;

    const flowPos = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (!draftStart) {
      const closest = findNearestHandle(flowPos, diagram.nodes);
      let endpoint: import('../core/types').DiagramEdgeEndpoint;
      if (closest && closest.distance < SNAP_THRESHOLD) {
        const side = closest.handleId.split('-')[0];
        endpoint = {
          kind: 'connected',
          nodeId: closest.nodeId,
          handleId: `${side}-source`,
        };
        setDraftStart({ x: closest.x, y: closest.y, endpoint });
      } else {
        endpoint = {
          kind: 'detached',
          point: flowPos,
        };
        setDraftStart({ x: flowPos.x, y: flowPos.y, endpoint });
      }
      setDraftMousePos(flowPos);
    } else {
      const closest = findNearestHandle(flowPos, diagram.nodes);
      let targetEndpoint: import('../core/types').DiagramEdgeEndpoint;
      if (closest && closest.distance < SNAP_THRESHOLD) {
        const side = closest.handleId.split('-')[0];
        targetEndpoint = {
          kind: 'connected',
          nodeId: closest.nodeId,
          handleId: `${side}-target`,
        };
      } else {
        targetEndpoint = {
          kind: 'detached',
          point: flowPos,
        };
      }

      addEdge(draftStart.endpoint, targetEndpoint);

      setDraftStart(null);
      setDraftMousePos(null);
      setActiveTool('select');
    }
  }, [activeTool, draftStart, diagram, addEdge, screenToFlowPosition, setActiveTool]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (activeTool === 'arrow' && draftStart) {
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setDraftMousePos(flowPos);
    }
  }, [activeTool, draftStart, screenToFlowPosition]);

  // Double-clicking the background pane creates a new process node
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    if (activeTool === 'arrow') return;
    const target = event.target as HTMLElement;
    if (target.classList.contains('react-flow__pane')) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode('process', position.x, position.y);
    }
  }, [addNode, screenToFlowPosition, activeTool]);

  // Build the confirmation message based on the pending delete state
  const pendingDeleteMessage = useMemo(() => {
    if (!pendingDelete) return '';
    const { nodeIds, cascadeEdgeCount } = pendingDelete;
    if (nodeIds.length === 1) {
      return `Ce nœud est connecté à ${cascadeEdgeCount} liaison(s). Supprimer ce nœud supprimera aussi ces liaisons.`;
    }
    return `Ces ${nodeIds.length} nœuds sont connectés à ${cascadeEdgeCount} liaison(s) au total. Supprimer ces nœuds supprimera aussi ces liaisons.`;
  }, [pendingDelete]);

  const handleNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    startTransaction();

    if (node.type === 'ghostAnchor') {
      const parts = node.id.split('__');
      if (parts.length >= 3) {
        const edgeId = parts[1];
        const endpoint = parts[2] as 'from' | 'to';
        const edge = diagram.edges.find((e) => e.id === edgeId);
        if (edge) {
          const ep = endpoint === 'from' ? edge.from : edge.to;
          if (ep.kind === 'connected') {
            const currentPos = getEdgeEndpointPosition(edgeId, endpoint, diagram, virtualAnchors);
            moveDetachedEdgeEndpoint({ edgeId, endpoint, point: currentPos });
          }
        }
      }
    }

    if (node && node.position) {
      dragStartPosRef.current = { x: node.position.x, y: node.position.y };
    }
  }, [startTransaction, diagram, moveDetachedEdgeEndpoint, virtualAnchors]);

  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'ghostAnchor') {
      const parts = node.id.split('__');
      if (parts.length >= 3) {
        const edgeId = parts[1];
        const endpoint = parts[2] as 'from' | 'to';

        const closest = findNearestHandle(node.position, diagram.nodes);
        if (closest && closest.distance < SNAP_THRESHOLD) {
          const side = closest.handleId.split('-')[0];
          const targetHandle = endpoint === 'from' ? `${side}-source` : `${side}-target`;

          reconnectDetachedEdgeEndpoint({
            edgeId,
            endpoint,
            nodeId: closest.nodeId,
            handleId: targetHandle,
          });
        }
      }
      commitTransaction();
      return;
    }

    commitTransaction();
    if (!USE_GROUPS_AND_SWIMLANES) return;
    if (node.type !== 'customNode') return;

    const startPos = dragStartPosRef.current;
    if (!startPos) return;
    dragStartPosRef.current = null;

    const dx = node.position.x - startPos.x;
    const dy = node.position.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    const w = node.measured?.width ?? node.data?.width ?? 100;
    const h = node.measured?.height ?? node.data?.height ?? 40;
    const nodeCenterX = node.position.x + w / 2;
    const nodeCenterY = node.position.y + h / 2;

    const groups = diagram.groups || [];
    let matchedGroup: DiagramGroup | null = null;
    let minArea = Infinity;
    const tolerance = GROUP_MEMBERSHIP_TOLERANCE;

    for (const group of groups) {
      const gX = group.position.x;
      const gY = group.position.y;
      const gW = group.width;
      const gH = group.height;

      const isInside =
        nodeCenterX >= gX - tolerance &&
        nodeCenterX <= gX + gW + tolerance &&
        nodeCenterY >= gY - tolerance &&
        nodeCenterY <= gY + gH + tolerance;

      if (isInside) {
        const area = gW * gH;
        if (area < minArea) {
          minArea = area;
          matchedGroup = group;
        }
      }
    }

    const currentParentGroupId = diagram.nodes.find((n) => n.id === node.id)?.parentGroupId;
    const newParentGroupId = matchedGroup ? matchedGroup.id : undefined;

    if (currentParentGroupId !== newParentGroupId) {
      assignNodeToGroup(node.id, newParentGroupId);
    }
  }, [commitTransaction, diagram.groups, diagram.nodes, assignNodeToGroup, reconnectDetachedEdgeEndpoint]);

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
      <div 
        className={`canvas-container ${activeTool === 'arrow' ? 'cursor-crosshair' : ''}`} 
        style={{ width: '100%', height: '100%' }}
        onPointerMove={onPointerMove}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onPaneClick={handleCanvasClick}
          onNodeClick={(event) => handleCanvasClick(event)}
          onPaneDoubleClick={onPaneDoubleClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          nodesSelectable={activeTool !== 'arrow'}
          nodesDraggable={activeTool !== 'arrow'}
          edgesFocusable={activeTool !== 'arrow'}
          elementsSelectable={activeTool !== 'arrow'}
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
                groupIds: pendingDelete.groupIds,
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
                  endpointPositions[edge.id].from = getEdgeEndpointPosition(edge.id, 'from', diagram, virtualAnchors);
                }
                if (toId && selNodeIdSet.has(toId)) {
                  endpointPositions[edge.id].to = getEdgeEndpointPosition(edge.id, 'to', diagram, virtualAnchors);
                }
              }

              deleteSelectedElements({
                nodeIds: pendingDelete.nodeIds,
                edgeIds: pendingDelete.edgeIds,
                textBoxIds: pendingDelete.textBoxIds,
                groupIds: pendingDelete.groupIds,
                connectedEdgeBehavior: 'detach',
                endpointPositions,
              });
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        )}

        {pendingGroupDelete && (
          <ConfirmModal
            title="Supprimer le(s) groupe(s)"
            message="Ce(s) groupe(s) contien(nen)t des nœuds. Souhaitez-vous supprimer aussi les nœuds enfants ?"
            confirmLabel="Supprimer le(s) groupe(s) et les nœuds enfants"
            cancelLabel="Annuler"
            middleLabel="Supprimer uniquement le(s) groupe(s)"
            variant="danger"
            onConfirm={() => {
              const { groupIds, nodeIds, textBoxIds, edgeIds } = pendingGroupDelete;
              setPendingGroupDelete(null);
              proceedWithDeletion({
                groupIds,
                nodeIds,
                textBoxIds,
                edgeIds,
                deleteChildren: true,
              });
            }}
            onMiddle={() => {
              const { groupIds, nodeIds, textBoxIds, edgeIds } = pendingGroupDelete;
              setPendingGroupDelete(null);
              proceedWithDeletion({
                groupIds,
                nodeIds,
                textBoxIds,
                edgeIds,
                deleteChildren: false,
              });
            }}
            onCancel={() => setPendingGroupDelete(null)}
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
