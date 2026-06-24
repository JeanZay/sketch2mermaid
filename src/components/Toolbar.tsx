import React from 'react';
import { useEdges, useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import type { NodeShape } from '../core/types';
import { SHAPE_DEFINITIONS, type ShapeCategory } from '../core/shapeRegistry';
import { SHAPE_ICONS } from './shapeIcons';

export const Toolbar = () => {
  const addNode = useDiagramStore((state) => state.addNode);
  const toggleEdgeStyle = useDiagramStore((state) => state.toggleEdgeStyle);
  const diagram = useDiagramStore((state) => state.diagram);
  const addTextBox = useDiagramStore((state) => state.addTextBox);

  const edges = useEdges();
  const { screenToFlowPosition } = useReactFlow();

  const selectedEdge = edges.find((e) => e.selected);
  const currentEdgeData = selectedEdge ? diagram.edges.find((e) => e.id === selectedEdge.id) : null;
  const isDotted = currentEdgeData ? currentEdgeData.style === 'dotted' : false;

  // Computes the center of the current canvas viewport to place new nodes
  const getCenterCoordinates = () => {
    const canvasEl = document.querySelector('.react-flow');
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    return { x: 150, y: 150 };
  };

  const handleShapeClick = (shape: NodeShape) => {
    const coords = getCenterCoordinates();
    addNode(shape, coords.x, coords.y);
  };

  const handleAddTextBox = () => {
    const coords = getCenterCoordinates();
    addTextBox(coords.x, coords.y);
  };

  const handleToggleStyle = (targetDotted: boolean) => {
    if (selectedEdge && isDotted !== targetDotted) {
      toggleEdgeStyle(selectedEdge.id);
    }
  };

  const categories: { key: ShapeCategory; label: string }[] = [
    { key: 'basic', label: 'Basic' },
    { key: 'data', label: 'Data / Storage' },
    { key: 'document', label: 'Documents' },
    { key: 'event', label: 'Events / Control' },
    { key: 'comment', label: 'Comments' },
    { key: 'advanced', label: 'Advanced' },
  ];

  const getShapesByCategory = (catKey: ShapeCategory) => {
    return SHAPE_DEFINITIONS.filter((def) => def.category === catKey);
  };

  return (
    <aside className="sidebar-palette">
      <div className="sidebar-scrollable-content">
        <h3 className="sidebar-section-title">Shapes</h3>
        {categories.map((cat) => {
          const catShapes = getShapesByCategory(cat.key);
          return (
            <details key={cat.key} open className="sidebar-category-details">
              <summary className="sidebar-category-summary">
                {cat.label}
              </summary>
              <div className="shapes-list">
                {catShapes.map((s) => {
                  const icon = SHAPE_ICONS[s.iconKey];
                  return (
                    <button
                      key={s.nodeShape}
                      onClick={() => handleShapeClick(s.nodeShape)}
                      title={`Ajouter un nœud ${s.uiLabel} (shape: ${s.mermaidShape})`}
                      className="palette-shape-btn"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {icon}
                      </svg>
                      <span className="palette-shape-btn-text">{s.uiLabel}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}

        <div className="sidebar-divider"></div>

        <h3 className="sidebar-section-title">Connection</h3>
        <div className="connection-section-controls">
          <button
            className="palette-shape-btn static-btn"
            title="Reliez les nœuds en glissant depuis leurs points d'ancrage (Handles)"
            disabled
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14m-7-7l7 7-7 7"></path>
            </svg>
            <span className="palette-shape-btn-text">Arrow</span>
          </button>

          <div className={`style-segmented-control-palette ${!selectedEdge ? 'disabled-control' : ''}`}>
            <button
              className={`segment-btn-palette ${!isDotted ? 'active' : ''}`}
              onClick={() => handleToggleStyle(false)}
              disabled={!selectedEdge}
              title={selectedEdge ? "Ligne pleine" : "Sélectionnez une arête pour modifier son style"}
            >
              Solid
            </button>
            <button
              className={`segment-btn-palette ${isDotted ? 'active' : ''}`}
              onClick={() => handleToggleStyle(true)}
              disabled={!selectedEdge}
              title={selectedEdge ? "Ligne pointillée" : "Sélectionnez une arête pour modifier son style"}
            >
              Dotted
            </button>
          </div>
        </div>

        <div className="sidebar-divider"></div>

        <h3 className="sidebar-section-title">Annotations</h3>
        <div className="shapes-list">
          <button
            onClick={handleAddTextBox}
            title="Add a text box annotation"
            className="palette-shape-btn"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <text x="5" y="17" fontSize="16" fontWeight="bold" fontFamily="serif" fill="currentColor" stroke="none">T</text>
              <line x1="5" y1="20" x2="19" y2="20" strokeWidth="1.5"></line>
            </svg>
            <span className="palette-shape-btn-text">Text</span>
          </button>
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="version-label">v0.1.0</span>
      </div>
    </aside>
  );
};

export default Toolbar;
