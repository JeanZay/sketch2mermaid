import React, { useState } from 'react';
import { useEdges, useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import type { NodeShape } from '../core/types';
import { SHAPE_DEFINITIONS, SHAPE_CATEGORIES } from '../core/shapeRegistry';
import { USE_GROUPS_AND_SWIMLANES } from '../core/config';
import { ShapePaletteIcon } from './ShapePaletteIcon';
import { SettingsModal } from './SettingsModal';

export const Toolbar = () => {
  const addNode = useDiagramStore((state) => state.addNode);
  const addEdge = useDiagramStore((state) => state.addEdge);
  const toggleEdgeStyle = useDiagramStore((state) => state.toggleEdgeStyle);
  const diagram = useDiagramStore((state) => state.diagram);
  const addTextBox = useDiagramStore((state) => state.addTextBox);
  const addGroup = useDiagramStore((state) => state.addGroup);

  const activeTool = useDiagramStore((state) => state.activeTool);
  const setActiveTool = useDiagramStore((state) => state.setActiveTool);

  const edges = useEdges();
  const { screenToFlowPosition } = useReactFlow();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const handleAddGroupClick = (kind: import('../core/types').DiagramGroupKind) => {
    const coords = getCenterCoordinates();
    addGroup(kind, coords.x, coords.y);
  };

  const handleToggleStyle = (targetDotted: boolean) => {
    if (selectedEdge && isDotted !== targetDotted) {
      toggleEdgeStyle(selectedEdge.id);
    }
  };

  const getShapesByCategory = (catKey: string) => {
    return SHAPE_DEFINITIONS.filter((def) => def.category === catKey);
  };

  return (
    <aside className="sidebar-palette">
      <div className="sidebar-scrollable-content">
        <h3 className="sidebar-section-title">Shapes</h3>
        {SHAPE_CATEGORIES.map((cat) => {
          const catShapes = getShapesByCategory(cat.key);
          return (
            <details key={cat.key} open className="sidebar-category-details">
              <summary className="sidebar-category-summary">
                {cat.label}
              </summary>
              <div className="shapes-list">
                {catShapes.map((s) => {
                  return (
                    <button
                      key={s.nodeShape}
                      onClick={() => handleShapeClick(s.nodeShape)}
                      title={`Ajouter un nœud ${s.uiLabel} (shape: ${s.mermaidShape})`}
                      className="palette-shape-btn"
                    >
                      <ShapePaletteIcon shapeId={s.nodeShape} width="24" height="24" />
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
            className={`palette-shape-btn ${activeTool === 'arrow' ? 'active' : ''}`}
            title="Créer une flèche libre sur le canvas"
            onClick={() => {
              if (activeTool === 'arrow') {
                setActiveTool('select');
                return;
              }
              const center = getCenterCoordinates();
              const ARROW_HALF_LEN = 50;
              const edgeId = addEdge(
                { kind: 'detached' as const, point: { x: center.x - ARROW_HALF_LEN, y: center.y } },
                { kind: 'detached' as const, point: { x: center.x + ARROW_HALF_LEN, y: center.y } },
              );
              // Request Canvas to select this edge
              useDiagramStore.setState({ pendingEdgeSelect: edgeId });
            }}
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
        {USE_GROUPS_AND_SWIMLANES && (
          <>
            <div className="sidebar-divider"></div>
            <h3 className="sidebar-section-title">Containers</h3>
            <div className="shapes-list">
              <button
                onClick={() => handleAddGroupClick('subgraph')}
                title="Add a visual container group (subgraph)"
                className="palette-shape-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"></rect>
                  <text x="6" y="14" fontSize="10" fontWeight="bold" fill="currentColor" stroke="none">GRP</text>
                </svg>
                <span className="palette-shape-btn-text">Group</span>
              </button>
              <button
                onClick={() => handleAddGroupClick('lane')}
                title="Add a swim-lane container (BPMN lane)"
                className="palette-shape-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <line x1="3" y1="17" x2="21" y2="17"></line>
                </svg>
                <span className="palette-shape-btn-text">Swimlane</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 16px', boxSizing: 'border-box' }}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="sidebar-settings-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
          title="Open Application Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
        <span className="version-label">v0.1.0</span>
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </aside>
  );
};

export default Toolbar;
