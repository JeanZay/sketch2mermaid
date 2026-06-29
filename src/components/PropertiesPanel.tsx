import React, { useState, useCallback } from 'react';
import { useNodes, useEdges } from '@xyflow/react';
import { useDiagramStore, DEFAULT_NODE_TEXT_STYLE, DEFAULT_EDGE_TEXT_STYLE, DEFAULT_TEXT_BOX_STYLE } from '../store/diagramStore';
import type { TextStyle, TextBoxStyle } from '../core/types';
import { SHAPE_DEFINITIONS, SHAPE_CATEGORIES, shapeSupportsLabel } from '../core/shapeRegistry';
import { ShapePaletteIcon } from './ShapePaletteIcon';
import { FontSizeControl } from './properties/FontSizeControl';
import { ConfirmModal } from './ConfirmModal';
import { useVirtualEdgeAnchors } from '../hooks/useVirtualEdgeAnchors';
import { USE_GROUPS_AND_SWIMLANES } from '../core/config';
import { collectSelectionInput } from '../utils/selectionHelpers';

export const PropertiesPanel = () => {
  const nodes = useNodes();
  const edges = useEdges();

  const selectedNode = nodes.find((n) => n.selected);
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const diagram = useDiagramStore((state) => state.diagram);
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const updateNodeShape = useDiagramStore((state) => state.updateNodeShape);
  const updateEdgeLabel = useDiagramStore((state) => state.updateEdgeLabel);
  const toggleEdgeStyle = useDiagramStore((state) => state.toggleEdgeStyle);
  const deleteEdge = useDiagramStore((state) => state.deleteEdge);
  const updateEdgeTextStyle = useDiagramStore((state) => state.updateEdgeTextStyle);
  const updateEdgeDirection = useDiagramStore((state) => state.updateEdgeDirection);
  const updateTextBoxText = useDiagramStore((state) => state.updateTextBoxText);
  const updateTextBoxStyle = useDiagramStore((state) => state.updateTextBoxStyle);
  const deleteTextBox = useDiagramStore((state) => state.deleteTextBox);
  const updateNodeStyle = useDiagramStore((state) => state.updateNodeStyle);
  const startTransaction = useDiagramStore((state) => state.startTransaction);
  const commitTransaction = useDiagramStore((state) => state.commitTransaction);
  const deleteSelectedElements = useDiagramStore((state) => state.deleteSelectedElements);
  const assignNodeToGroup = useDiagramStore((state) => state.assignNodeToGroup);
  const groupSelection = useDiagramStore((state) => state.groupSelection);
  const duplicateSelection = useDiagramStore((state) => state.duplicateSelection);
  const clearSelection = useDiagramStore((state) => state.clearSelection);

  const virtualAnchors = useVirtualEdgeAnchors();

  const handleDeselect = () => {
    clearSelection();
  };

  const handleDuplicate = useCallback(() => {
    const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);
    const { nodeIds, edgeIds, textBoxIds } = collectSelectionInput(selectedNodes, selectedEdgeIds);

    duplicateSelection({
      nodeIds,
      edgeIds,
      textBoxIds,
    });
  }, [selectedNodes, edges, duplicateSelection]);

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

  const [pendingDeleteNode, setPendingDeleteNode] = useState<{
    nodeId: string;
    edgeCount: number;
  } | null>(null);

  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<{
    id: string;
  } | null>(null);

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    const edgeCount = diagram.edges.filter((e) => {
      const fromId = e.from.kind === 'connected' ? e.from.nodeId : null;
      const toId = e.to.kind === 'connected' ? e.to.nodeId : null;
      return fromId === selectedNode.id || toId === selectedNode.id;
    }).length;

    if (edgeCount === 0) {
      deleteSelectedElements({
        nodeIds: [selectedNode.id],
        edgeIds: [],
        textBoxIds: [],
        connectedEdgeBehavior: 'delete',
      });
    } else {
      setPendingDeleteNode({ nodeId: selectedNode.id, edgeCount });
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge) {
      deleteEdge(selectedEdge.id);
    }
  };

  const handleDeleteTextBox = () => {
    if (selectedNode) {
      deleteTextBox(selectedNode.id);
    }
  };

  // ------ MULTI SELECTION properties ------
  if (selectedNodes.length > 1) {
    const customNodeIds = selectedNodes
      .filter((n) => n.type === 'customNode')
      .map((n) => n.id);

    return (
      <div className="properties-panel-content">
        <div className="properties-header">
          <div className="properties-header-title">
            <button className="back-button" onClick={handleDeselect} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="properties-title-text">Sélection multiple</span>
          </div>
          <div className="properties-actions">
            <button
              className="duplicate-button"
              onClick={handleDuplicate}
              title="Dupliquer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="properties-body">
          <p className="property-text-val" style={{ marginBottom: '16px' }}>
            {selectedNodes.length} éléments sélectionnés.
          </p>

          {customNodeIds.length > 0 && USE_GROUPS_AND_SWIMLANES && (
            <div className="property-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="property-label">Créer un groupe</label>
              <button
                className="modal-btn modal-btn--confirm"
                style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                onClick={() => {
                  const newGroupId = groupSelection(customNodeIds, 'subgraph');
                  if (newGroupId) {
                    handleDeselect();
                  }
                }}
              >
                Créer un Groupe (Subgraph)
              </button>
              <button
                className="modal-btn modal-btn--middle"
                style={{ width: '100%', padding: '8px', fontSize: '13px', margin: 0 }}
                onClick={() => {
                  const newGroupId = groupSelection(customNodeIds, 'lane');
                  if (newGroupId) {
                    handleDeselect();
                  }
                }}
              >
                Créer une Ligne d'eau (Swimlane)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------ GROUP NODE properties ------
  if (selectedNode && selectedNode.type === 'groupNode' && USE_GROUPS_AND_SWIMLANES) {
    const groupData = diagram.groups?.find((g) => g.id === selectedNode.id);
    if (!groupData) return null;

    const updateGroupLabel = useDiagramStore.getState().updateGroupLabel;
    const updateGroupKind = useDiagramStore.getState().updateGroupKind;
    const updateGroupDirection = useDiagramStore.getState().updateGroupDirection;
    const updateGroupStyle = useDiagramStore.getState().updateGroupStyle;
    const deleteGroup = useDiagramStore.getState().deleteGroup;

    const handleGroupStyleChange = (updates: Partial<import('../core/types').GroupStyle>) => {
      updateGroupStyle(selectedNode.id, updates);
    };

    return (
      <div className="properties-panel-content">
        <div className="properties-header">
          <div className="properties-header-title">
            <button className="back-button" onClick={handleDeselect} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="properties-title-text">{groupData.kind === 'lane' ? 'Swimlane' : 'Group'}</span>
          </div>
          <button
            className="delete-button text-error"
            onClick={() => {
              const hasChildren = diagram.nodes.some((n) => n.parentGroupId === groupData.id);
              if (!hasChildren) {
                deleteGroup(groupData.id, { deleteChildren: false });
                handleDeselect();
              } else {
                setPendingDeleteGroup({ id: groupData.id });
              }
            }}
            title="Delete group"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>

        <div className="properties-body">
          <div className="property-group">
            <label className="property-label">Label</label>
            <input
              type="text"
              value={groupData.label}
              onChange={(e) => updateGroupLabel(groupData.id, e.target.value)}
              onFocus={startTransaction}
              onBlur={commitTransaction}
              className="property-input"
            />
          </div>

          <div className="property-group">
            <label className="property-label">Type</label>
            <div className="style-segmented-control">
              <button
                className={`segment-btn ${groupData.kind === 'subgraph' ? 'active' : ''}`}
                onClick={() => updateGroupKind(groupData.id, 'subgraph')}
              >
                Subgraph
              </button>
              <button
                className={`segment-btn ${groupData.kind === 'lane' ? 'active' : ''}`}
                onClick={() => updateGroupKind(groupData.id, 'lane')}
              >
                Swimlane
              </button>
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Direction (subgraph only)</label>
            <div className="style-segmented-control">
              <button
                className={`segment-btn ${groupData.direction === 'TD' || !groupData.direction ? 'active' : ''}`}
                onClick={() => updateGroupDirection(groupData.id, 'TD')}
              >
                Vertical (TD)
              </button>
              <button
                className={`segment-btn ${groupData.direction === 'LR' ? 'active' : ''}`}
                onClick={() => updateGroupDirection(groupData.id, 'LR')}
              >
                Horizontal (LR)
              </button>
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Background Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={groupData.style?.backgroundColor || '#f9fafb'}
                onChange={(e) => handleGroupStyleChange({ backgroundColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={groupData.style?.backgroundColor || ''}
                placeholder="#f9fafb"
                onChange={(e) => handleGroupStyleChange({ backgroundColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Border Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={groupData.style?.borderColor || '#e5e7eb'}
                onChange={(e) => handleGroupStyleChange({ borderColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={groupData.style?.borderColor || ''}
                placeholder="#e5e7eb"
                onChange={(e) => handleGroupStyleChange({ borderColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
            </div>
          </div>

          <div className="property-divider"></div>

          <div className="property-group-row">
            <span className="property-label-inline">Mermaid ID</span>
            <span className="property-badge">{groupData.id}</span>
          </div>
        </div>

        {pendingDeleteGroup && (
          <ConfirmModal
            title="Supprimer le groupe"
            message="Ce groupe contient des nœuds. Souhaitez-vous supprimer aussi les nœuds enfants ?"
            confirmLabel="Supprimer le groupe et ses nœuds"
            cancelLabel="Annuler"
            middleLabel="Supprimer uniquement le groupe"
            variant="danger"
            onConfirm={() => {
              deleteGroup(pendingDeleteGroup.id, { deleteChildren: true });
              setPendingDeleteGroup(null);
              handleDeselect();
            }}
            onMiddle={() => {
              deleteGroup(pendingDeleteGroup.id, { deleteChildren: false });
              setPendingDeleteGroup(null);
              handleDeselect();
            }}
            onCancel={() => setPendingDeleteGroup(null)}
          />
        )}
      </div>
    );
  }

  // ------ TEXT BOX properties (refinement #2: distinguish by node type, not ID prefix) ------
  if (selectedNode && selectedNode.type === 'textBox') {
    const textBoxData = diagram.textBoxes.find((tb) => tb.id === selectedNode.id);
    if (!textBoxData) return null;

    const style = textBoxData.style;

    const handleStyleChange = (updates: Partial<TextBoxStyle>) => {
      updateTextBoxStyle(selectedNode.id, updates);
    };

    return (
      <div className="properties-panel-content">
        <div className="properties-header">
          <div className="properties-header-title">
            <button className="back-button" onClick={handleDeselect} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="properties-title-text">Text Box</span>
          </div>
          <div className="properties-actions">
            <button
              className="duplicate-button"
              onClick={handleDuplicate}
              title="Dupliquer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="delete-button text-error" onClick={handleDeleteTextBox} title="Delete text box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="properties-body">
          <div className="property-group">
            <label className="property-label">Text</label>
            <textarea
              value={textBoxData.text}
              onChange={(e) => updateTextBoxText(selectedNode.id, e.target.value)}
              onFocus={startTransaction}
              onBlur={commitTransaction}
              className="property-input property-textarea"
              rows={3}
            />
          </div>

          <div className="property-group">
            <label className="property-label">Background Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={style.backgroundColor || '#ffffff'}
                onChange={(e) => handleStyleChange({ backgroundColor: e.target.value.trim() || undefined })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={style.backgroundColor || ''}
                placeholder="Transparent"
                onChange={(e) => handleStyleChange({ backgroundColor: e.target.value.trim() || undefined })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
              {style.backgroundColor && (
                <button
                  className="clear-color-btn"
                  onClick={() => handleStyleChange({ backgroundColor: undefined })}
                  title="Make transparent"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Border Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={style.borderColor || '#c4c5d7'}
                onChange={(e) => handleStyleChange({ borderColor: e.target.value.trim() || undefined })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={style.borderColor || ''}
                placeholder="Transparent"
                onChange={(e) => handleStyleChange({ borderColor: e.target.value.trim() || undefined })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
              {style.borderColor && (
                <button
                  className="clear-color-btn"
                  onClick={() => handleStyleChange({ borderColor: undefined })}
                  title="Make transparent"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Font Size</label>
            <FontSizeControl
              value={style.fontSize ?? DEFAULT_TEXT_BOX_STYLE.fontSize!}
              onChange={(val) => handleStyleChange({ fontSize: val })}
            />
          </div>

          <div className="property-group">
            <label className="property-label">Format</label>
            <div className="text-format-controls">
              <button
                className={`format-toggle-btn ${style.bold ? 'active' : ''}`}
                onClick={() => handleStyleChange({ bold: !style.bold })}
                title="Bold"
              >
                <strong>B</strong>
              </button>
              <button
                className={`format-toggle-btn ${style.italic ? 'active' : ''}`}
                onClick={() => handleStyleChange({ italic: !style.italic })}
                title="Italic"
              >
                <em>I</em>
              </button>
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Alignment</label>
            <div className="style-segmented-control">
              <button
                className={`segment-btn ${style.textAlign === 'left' ? 'active' : ''}`}
                onClick={() => handleStyleChange({ textAlign: 'left' })}
              >
                Left
              </button>
              <button
                className={`segment-btn ${style.textAlign === 'center' ? 'active' : ''}`}
                onClick={() => handleStyleChange({ textAlign: 'center' })}
              >
                Center
              </button>
              <button
                className={`segment-btn ${style.textAlign === 'right' ? 'active' : ''}`}
                onClick={() => handleStyleChange({ textAlign: 'right' })}
              >
                Right
              </button>
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Text Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={style.color}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={style.color}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
            </div>
          </div>

          <div className="property-divider"></div>

          <div className="annotation-info-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>This text box is a visual annotation. It is not included in Mermaid export.</span>
          </div>
        </div>
      </div>
    );
  }

  // ------ DIAGRAM NODE properties ------
  if (selectedNode && selectedNode.type === 'customNode') {
    const nodeData = diagram.nodes.find((n) => n.id === selectedNode.id);
    if (!nodeData) return null;

    // Calculate connections
    const inEdges = diagram.edges.filter((e) => e.to === selectedNode.id).length;
    const outEdges = diagram.edges.filter((e) => e.from === selectedNode.id).length;

    const updateNodeTextStyle = useDiagramStore.getState().updateNodeTextStyle;
    const style = { ...DEFAULT_NODE_TEXT_STYLE, ...nodeData.style?.text };

    const handleStyleChange = (updates: Partial<TextStyle>) => {
      updateNodeTextStyle(selectedNode.id, updates);
    };

    const handleNodeStyleChange = (updates: Partial<import('../core/types').NodeStyle>) => {
      updateNodeStyle(selectedNode.id, updates);
    };


    return (
      <>
      <div className="properties-panel-content">
        <div className="properties-header">
          <div className="properties-header-title">
            <button className="back-button" onClick={handleDeselect} title="Retour au code">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="properties-title-text">Properties</span>
          </div>
          <div className="properties-actions">
            <button
              className="duplicate-button"
              onClick={handleDuplicate}
              title="Dupliquer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="delete-button text-error" onClick={handleDeleteNode} title="Supprimer le nœud">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="properties-body">
          {shapeSupportsLabel(nodeData.shape) && (
            <div className="property-group">
              <label className="property-label">Label</label>
              <input
                type="text"
                value={nodeData.label}
                onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input"
              />
            </div>
          )}

          <div className="property-group">
            <label className="property-label">Background Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={nodeData.style?.backgroundColor || '#ffffff'}
                onChange={(e) => handleNodeStyleChange({ backgroundColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={nodeData.style?.backgroundColor || ''}
                placeholder="#ffffff"
                onChange={(e) => handleNodeStyleChange({ backgroundColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Border Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={nodeData.style?.borderColor || '#c4c5d7'}
                onChange={(e) => handleNodeStyleChange({ borderColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="color-picker"
              />
              <input
                type="text"
                value={nodeData.style?.borderColor || ''}
                placeholder="#c4c5d7"
                onChange={(e) => handleNodeStyleChange({ borderColor: e.target.value })}
                onFocus={startTransaction}
                onBlur={commitTransaction}
                className="property-input color-text-input"
              />
            </div>
          </div>

          {shapeSupportsLabel(nodeData.shape) && (
            <>
              <div className="property-group">
                <label className="property-label">Font Size</label>
                <div className="annotation-info-text" style={{ marginBottom: 4, padding: 0 }}>
                  {nodeData.style?.text?.fontSize ? 'Custom size:' : 'Auto-fit (default):'}
                </div>
                <FontSizeControl
                  value={style.fontSize ?? 14}
                  onChange={(val) => handleStyleChange({ fontSize: val })}
                />
              </div>

              <div className="property-group">
                <label className="property-label">Format</label>
                <div className="text-format-controls">
                  <button
                    className={`format-toggle-btn ${style.bold ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ bold: !style.bold })}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    className={`format-toggle-btn ${style.italic ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ italic: !style.italic })}
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                </div>
              </div>

              <div className="property-group">
                <label className="property-label">Alignment</label>
                <div className="style-segmented-control">
                  <button
                    className={`segment-btn ${style.textAlign === 'left' ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ textAlign: 'left' })}
                  >
                    Left
                  </button>
                  <button
                    className={`segment-btn ${style.textAlign === 'center' ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ textAlign: 'center' })}
                  >
                    Center
                  </button>
                  <button
                    className={`segment-btn ${style.textAlign === 'right' ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ textAlign: 'right' })}
                  >
                    Right
                  </button>
                </div>
              </div>

              <div className="property-group">
                <label className="property-label">Text Color</label>
                <div className="color-input-row">
                  <input
                    type="color"
                    value={style.color}
                    onChange={(e) => handleStyleChange({ color: e.target.value })}
                    onFocus={startTransaction}
                    onBlur={commitTransaction}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={style.color}
                    onChange={(e) => handleStyleChange({ color: e.target.value })}
                    onFocus={startTransaction}
                    onBlur={commitTransaction}
                    className="property-input color-text-input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="property-group">
            <label className="property-label">Shape</label>
            <div className="properties-shape-selector" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px' }}>
              {SHAPE_CATEGORIES.map((cat) => {
                const catShapes = SHAPE_DEFINITIONS.filter((def) => def.category === cat.key);
                return (
                  <div key={cat.key} className="properties-shape-cat-section" style={{ marginBottom: '8px' }}>
                    <div className="properties-shape-cat-header" style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {cat.label}
                    </div>
                    <div className="shape-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {catShapes.map((s) => {
                        return (
                          <button
                            key={s.nodeShape}
                            className={`shape-select-btn ${nodeData.shape === s.nodeShape ? 'active' : ''}`}
                            onClick={() => updateNodeShape(selectedNode.id, s.nodeShape)}
                            title={`${s.uiLabel} (shape: ${s.mermaidShape})`}
                          >
                            <ShapePaletteIcon shapeId={s.nodeShape} width="18" height="18" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Connections</label>
            <span className="property-text-val">
              {inEdges} in · {outEdges} out
            </span>
          </div>

          {USE_GROUPS_AND_SWIMLANES && (
            <div className="property-group">
              <label className="property-label">Parent Group</label>
              <select
                value={nodeData.parentGroupId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  assignNodeToGroup(nodeData.id, val ? val : undefined);
                }}
                className="property-input"
              >
                <option value="">(None)</option>
                {(diagram.groups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({g.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="property-divider"></div>

          <div className="property-group-row">
            <span className="property-label-inline">Mermaid ID</span>
            <span className="property-badge">{selectedNode.id}</span>
          </div>
        </div>
      </div>

      {pendingDeleteNode && (
        <ConfirmModal
          title="Supprimer le nœud"
          message={`Ce nœud est connecté à ${pendingDeleteNode.edgeCount} liaison(s). Supprimer ce nœud supprimera aussi ces liaisons.`}
          confirmLabel="Supprimer aussi les flèches"
          cancelLabel="Annuler"
          middleLabel="Conserver les flèches sur le canvas"
          variant="danger"
          onConfirm={() => {
            deleteSelectedElements({
              nodeIds: [pendingDeleteNode.nodeId],
              edgeIds: [],
              textBoxIds: [],
              connectedEdgeBehavior: 'delete',
            });
            setPendingDeleteNode(null);
          }}
          onMiddle={() => {
            const endpointPositions: Record<string, {
              from?: { x: number; y: number };
              to?: { x: number; y: number };
            }> = {};
            
            const connectedEdges = diagram.edges.filter((e) => {
              const fromId = e.from.kind === 'connected' ? e.from.nodeId : null;
              const toId = e.to.kind === 'connected' ? e.to.nodeId : null;
              return fromId === pendingDeleteNode.nodeId || toId === pendingDeleteNode.nodeId;
            });

            for (const edge of connectedEdges) {
              const fromId = edge.from.kind === 'connected' ? edge.from.nodeId : null;
              const toId = edge.to.kind === 'connected' ? edge.to.nodeId : null;
              
              endpointPositions[edge.id] = {};
              if (fromId === pendingDeleteNode.nodeId) {
                endpointPositions[edge.id].from = getEdgeEndpointPosition(edge.id, 'from');
              }
              if (toId === pendingDeleteNode.nodeId) {
                endpointPositions[edge.id].to = getEdgeEndpointPosition(edge.id, 'to');
              }
            }

            deleteSelectedElements({
              nodeIds: [pendingDeleteNode.nodeId],
              edgeIds: [],
              textBoxIds: [],
              connectedEdgeBehavior: 'detach',
              endpointPositions,
            });
            setPendingDeleteNode(null);
          }}
          onCancel={() => setPendingDeleteNode(null)}
        />
      )}
    </>
    );
  }

  // ------ EDGE properties ------
  if (selectedEdge) {
    const edgeData = diagram.edges.find((e) => e.id === selectedEdge.id);
    if (!edgeData) return null;

    const sourceNode = edgeData.from.kind === 'connected' ? diagram.nodes.find((n) => n.id === edgeData.from.nodeId) : null;
    const targetNode = edgeData.to.kind === 'connected' ? diagram.nodes.find((n) => n.id === edgeData.to.nodeId) : null;
    const sourceLabel = sourceNode ? sourceNode.label : (edgeData.from.kind === 'connected' ? edgeData.from.nodeId : 'Point détaché');
    const targetLabel = targetNode ? targetNode.label : (edgeData.to.kind === 'connected' ? edgeData.to.nodeId : 'Point détaché');

    const isDotted = edgeData.style === 'dotted';
    
    const style = { ...DEFAULT_EDGE_TEXT_STYLE, ...edgeData.textStyle };

    const handleStyleChange = (updates: Partial<TextStyle>) => {
      updateEdgeTextStyle(selectedEdge.id, updates);
    };

    return (
      <div className="properties-panel-content">
        <div className="properties-header">
          <div className="properties-header-title">
            <button className="back-button" onClick={handleDeselect} title="Retour au code">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="properties-title-text">Properties</span>
          </div>
          <div className="properties-actions">
            <button
              className="duplicate-button"
              onClick={handleDuplicate}
              title="Dupliquer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="delete-button text-error" onClick={handleDeleteEdge} title="Supprimer la liaison">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="properties-body">
          <div className="property-group">
            <label className="property-label">Label</label>
            <input
              type="text"
              value={edgeData.label || ''}
              onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
              onFocus={startTransaction}
              onBlur={commitTransaction}
              placeholder="Ex: Oui, Non, ..."
              className="property-input"
            />
          </div>

          <div className="property-group">
            <label className="property-label">Style</label>
            <div className="style-segmented-control">
              <button
                className={`segment-btn ${!isDotted ? 'active' : ''}`}
                onClick={() => isDotted && toggleEdgeStyle(selectedEdge.id)}
              >
                Solid
              </button>
              <button
                className={`segment-btn ${isDotted ? 'active' : ''}`}
                onClick={() => !isDotted && toggleEdgeStyle(selectedEdge.id)}
              >
                Dotted
              </button>
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Direction</label>
            <div className="style-segmented-control">
              <button
                className={`segment-btn ${edgeData.direction === 'directed' || !edgeData.direction ? 'active' : ''}`}
                onClick={() => updateEdgeDirection(selectedEdge.id, 'directed')}
                title="Dirigée"
              >
                A → B
              </button>
              <button
                className={`segment-btn ${edgeData.direction === 'undirected' ? 'active' : ''}`}
                onClick={() => updateEdgeDirection(selectedEdge.id, 'undirected')}
                title="Non dirigée"
              >
                A — B
              </button>
              <button
                className={`segment-btn ${edgeData.direction === 'bidirectional' ? 'active' : ''}`}
                onClick={() => updateEdgeDirection(selectedEdge.id, 'bidirectional')}
                title="Bidirectionnelle"
              >
                A ↔ B
              </button>
              <button
                className={`segment-btn ${edgeData.direction === 'reverse' ? 'active' : ''}`}
                onClick={() => updateEdgeDirection(selectedEdge.id, 'reverse')}
                title="Inverse"
              >
                A ← B
              </button>
            </div>

          </div>

          {edgeData.label && edgeData.label.trim().length > 0 && (
            <>
              <div className="property-group">
                <label className="property-label">Font Size</label>
                <FontSizeControl
                  value={style.fontSize ?? DEFAULT_EDGE_TEXT_STYLE.fontSize!}
                  onChange={(val) => handleStyleChange({ fontSize: val })}
                />
              </div>

              <div className="property-group">
                <label className="property-label">Format</label>
                <div className="text-format-controls">
                  <button
                    className={`format-toggle-btn ${style.bold ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ bold: !style.bold })}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    className={`format-toggle-btn ${style.italic ? 'active' : ''}`}
                    onClick={() => handleStyleChange({ italic: !style.italic })}
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                </div>
              </div>

              <div className="property-group">
                <label className="property-label">Text Color</label>
                <div className="color-input-row">
                  <input
                    type="color"
                    value={style.color}
                    onChange={(e) => handleStyleChange({ color: e.target.value })}
                    onFocus={startTransaction}
                    onBlur={commitTransaction}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={style.color}
                    onChange={(e) => handleStyleChange({ color: e.target.value })}
                    onFocus={startTransaction}
                    onBlur={commitTransaction}
                    className="property-input color-text-input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="property-group">
            <label className="property-label">Statut</label>
            <div className="connection-status-info">
              {edgeData.connectionStatus === 'detached' ? (
                <div className="status-info-box status-info-box--detached">
                  <span className="status-badge status-badge--detached">Liaison détachée (Canvas uniquement)</span>
                  <p className="status-desc">
                    {edgeData.from.kind === 'detached' && edgeData.to.kind === 'detached'
                      ? 'Les deux extrémités sont détachées.'
                      : 'Une extrémité est détachée.'}
                  </p>
                  <p className="status-help">
                    Cette liaison ne sera pas exportée dans le code Mermaid tant qu’elle ne sera pas reconnectée à deux nœuds.
                  </p>
                </div>
              ) : edgeData.exportMode === 'canvasOnly' ? (
                <div className="status-info-box status-info-box--canvas-only">
                  <span className="status-badge status-badge--canvas-only">Liaison canvas uniquement</span>
                  <p className="status-help">
                    Cette liaison est connectée mais intentionnellement exclue de l’export Mermaid.
                  </p>
                </div>
              ) : (
                <div className="status-info-box status-info-box--connected">
                  <span className="status-badge status-badge--connected">Liaison Mermaid connectée</span>
                  <p className="status-help">
                    Cette liaison sera exportée dans le code Mermaid.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Connections</label>
            <div className="connections-badge-box">
              {sourceLabel} → {targetLabel}
            </div>
          </div>

          <div className="property-divider"></div>

          <div className="property-group-row">
            <span className="property-label-inline">Mermaid ID</span>
            <span className="property-badge">{selectedEdge.id}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PropertiesPanel;
