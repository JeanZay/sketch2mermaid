import React from 'react';
import { useNodes, useEdges, useReactFlow } from '@xyflow/react';
import { useDiagramStore, DEFAULT_NODE_TEXT_STYLE, DEFAULT_EDGE_TEXT_STYLE, DEFAULT_TEXT_BOX_STYLE } from '../store/diagramStore';
import type { TextStyle, TextBoxStyle } from '../core/types';
import { SHAPE_CONFIGS } from './shapeConfig';
import { FontSizeControl } from './properties/FontSizeControl';

export const PropertiesPanel = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const { setNodes, setEdges } = useReactFlow();

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const diagram = useDiagramStore((state) => state.diagram);
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const updateNodeShape = useDiagramStore((state) => state.updateNodeShape);
  const deleteNode = useDiagramStore((state) => state.deleteNode);
  const updateEdgeLabel = useDiagramStore((state) => state.updateEdgeLabel);
  const toggleEdgeStyle = useDiagramStore((state) => state.toggleEdgeStyle);
  const deleteEdge = useDiagramStore((state) => state.deleteEdge);
  const updateEdgeTextStyle = useDiagramStore((state) => state.updateEdgeTextStyle);
  const updateTextBoxText = useDiagramStore((state) => state.updateTextBoxText);
  const updateTextBoxStyle = useDiagramStore((state) => state.updateTextBoxStyle);
  const deleteTextBox = useDiagramStore((state) => state.deleteTextBox);
  const updateNodeStyle = useDiagramStore((state) => state.updateNodeStyle);

  const handleDeselect = () => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
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
          <button className="delete-button text-error" onClick={handleDeleteTextBox} title="Delete text box">
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
            <label className="property-label">Text</label>
            <textarea
              value={textBoxData.text}
              onChange={(e) => updateTextBoxText(selectedNode.id, e.target.value)}
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
                className="color-picker"
              />
              <input
                type="text"
                value={style.backgroundColor || ''}
                placeholder="Transparent"
                onChange={(e) => handleStyleChange({ backgroundColor: e.target.value.trim() || undefined })}
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
                className="color-picker"
              />
              <input
                type="text"
                value={style.borderColor || ''}
                placeholder="Transparent"
                onChange={(e) => handleStyleChange({ borderColor: e.target.value.trim() || undefined })}
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
                className="color-picker"
              />
              <input
                type="text"
                value={style.color}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
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
  if (selectedNode) {
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

    const shapes = SHAPE_CONFIGS;

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
          <button className="delete-button text-error" onClick={handleDeleteNode} title="Supprimer le nœud">
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
              value={nodeData.label}
              onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
              className="property-input"
            />
          </div>

          <div className="property-group">
            <label className="property-label">Background Color</label>
            <div className="color-input-row">
              <input
                type="color"
                value={nodeData.style?.backgroundColor || '#ffffff'}
                onChange={(e) => handleNodeStyleChange({ backgroundColor: e.target.value })}
                className="color-picker"
              />
              <input
                type="text"
                value={nodeData.style?.backgroundColor || ''}
                placeholder="#ffffff"
                onChange={(e) => handleNodeStyleChange({ backgroundColor: e.target.value })}
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
                className="color-picker"
              />
              <input
                type="text"
                value={nodeData.style?.borderColor || ''}
                placeholder="#c4c5d7"
                onChange={(e) => handleNodeStyleChange({ borderColor: e.target.value })}
                className="property-input color-text-input"
              />
            </div>
          </div>

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
                className="color-picker"
              />
              <input
                type="text"
                value={style.color}
                onChange={(e) => handleStyleChange({ color: e.target.value })}
                className="property-input color-text-input"
              />
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Shape</label>
            <div className="shape-grid">
              {shapes.map((s) => (
                <button
                  key={s.type}
                  className={`shape-select-btn ${nodeData.shape === s.type ? 'active' : ''}`}
                  onClick={() => updateNodeShape(selectedNode.id, s.type)}
                  title={s.label}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {s.svg}
                  </svg>
                  <span className="shape-select-btn-text">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="property-group">
            <label className="property-label">Connections</label>
            <span className="property-text-val">
              {inEdges} in · {outEdges} out
            </span>
          </div>

          <div className="property-divider"></div>

          <div className="property-group-row">
            <span className="property-label-inline">Mermaid ID</span>
            <span className="property-badge">{selectedNode.id}</span>
          </div>
        </div>
      </div>
    );
  }

  // ------ EDGE properties ------
  if (selectedEdge) {
    const edgeData = diagram.edges.find((e) => e.id === selectedEdge.id);
    if (!edgeData) return null;

    const sourceNode = diagram.nodes.find((n) => n.id === edgeData.from);
    const targetNode = diagram.nodes.find((n) => n.id === edgeData.to);
    const sourceLabel = sourceNode ? sourceNode.label : edgeData.from;
    const targetLabel = targetNode ? targetNode.label : edgeData.to;

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
          <button className="delete-button text-error" onClick={handleDeleteEdge} title="Supprimer la liaison">
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
              value={edgeData.label || ''}
              onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
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
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={style.color}
                    onChange={(e) => handleStyleChange({ color: e.target.value })}
                    className="property-input color-text-input"
                  />
                </div>
              </div>
            </>
          )}

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
