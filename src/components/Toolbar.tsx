import React from 'react';
import { useNodes, useEdges, useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import type { NodeShape } from '../core/types';

export const Toolbar = () => {
  const addNode = useDiagramStore((state) => state.addNode);
  const updateNodeShape = useDiagramStore((state) => state.updateNodeShape);
  const toggleEdgeStyle = useDiagramStore((state) => state.toggleEdgeStyle);
  const diagram = useDiagramStore((state) => state.diagram);

  const nodes = useNodes();
  const edges = useEdges();
  const { screenToFlowPosition } = useReactFlow();

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const currentEdgeData = selectedEdge ? diagram.edges.find((e) => e.id === selectedEdge.id) : null;
  const isDotted = currentEdgeData ? currentEdgeData.style === 'dotted' : false;

  // Computes the center of the current canvas viewport to place new nodes
  const getCenterCoordinates = () => {
    try {
      const clientWidth = window.innerWidth * 0.5; // Approx canvas width
      const clientHeight = window.innerHeight * 0.7; // Approx canvas height
      
      return screenToFlowPosition({
        x: clientWidth,
        y: clientHeight,
      });
    } catch {
      return { x: 150, y: 150 };
    }
  };

  const handleShapeClick = (shape: NodeShape) => {
    if (selectedNode) {
      updateNodeShape(selectedNode.id, shape);
    } else {
      const coords = getCenterCoordinates();
      addNode(shape, coords.x, coords.y);
    }
  };

  const handleToggleStyle = (targetDotted: boolean) => {
    if (selectedEdge && isDotted !== targetDotted) {
      toggleEdgeStyle(selectedEdge.id);
    }
  };

  // Shapes configuration
  const shapes: { type: NodeShape; label: string; svg: React.ReactNode }[] = [
    {
      type: 'process',
      label: 'Process',
      svg: <rect x="3" y="6" width="18" height="12" rx="1"></rect>,
    },
    {
      type: 'rounded',
      label: 'Rounded',
      svg: <rect x="3" y="6" width="18" height="12" rx="4"></rect>,
    },
    {
      type: 'stadium',
      label: 'Start / End',
      svg: <rect x="3" y="8" width="18" height="8" rx="4"></rect>,
    },
    {
      type: 'decision',
      label: 'Decision',
      svg: <rect x="8" y="8" width="8" height="8" transform="rotate(45 12 12)"></rect>,
    },
    {
      type: 'event',
      label: 'Event',
      svg: <circle cx="12" cy="12" r="8"></circle>,
    },
    {
      type: 'endEvent',
      label: 'End Event',
      svg: (
        <>
          <circle cx="12" cy="12" r="9"></circle>
          <circle cx="12" cy="12" r="6"></circle>
        </>
      ),
    },
  ];

  return (
    <aside className="sidebar-palette">
      <div className="sidebar-scrollable-content">
        <h3 className="sidebar-section-title">Shapes</h3>
        <div className="shapes-list">
          {shapes.map((s) => {
            const isActive = selectedNode
              ? diagram.nodes.find((n) => n.id === selectedNode.id)?.shape === s.type
              : false;
            return (
              <button
                key={s.type}
                onClick={() => handleShapeClick(s.type)}
                title={selectedNode ? `Changer le nœud en ${s.label}` : `Ajouter un nœud ${s.label}`}
                className={`palette-shape-btn ${isActive ? 'active' : ''}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {s.svg}
                </svg>
                <span className="palette-shape-btn-text">{s.label}</span>
              </button>
            );
          })}
        </div>

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
      </div>

      <div className="sidebar-footer">
        <span className="version-label">v0.1.0</span>
      </div>
    </aside>
  );
};

export default Toolbar;
