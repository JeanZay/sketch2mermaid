import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import mermaid from 'mermaid';
import { SHAPE_DEFINITIONS, SHAPE_CATEGORIES, type ShapeDefinition } from '../core/shapeRegistry';
import { importMermaidFlowchart } from '../core/mermaidImport';
import { toMermaid } from '../core/mermaid';
import CustomNode from './CustomNode';
import type { CanonicalDiagram, DiagramNode, DiagramEdge } from '../core/types';

// Register CustomNode for React Flow rendering
const nodeTypes = {
  customNode: CustomNode,
};

// Initialize Mermaid globally using the same config as the main app
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });
}

// Caching layer for Mermaid renders to prevent layout flashes and CPU load
const renderCache = new Map<string, { svg: string; error?: string }>();

async function getCachedMermaidRender(id: string, code: string): Promise<{ svg: string; error?: string }> {
  const cacheKey = code.trim();
  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey)!;
  }

  try {
    // Validate syntax first
    await mermaid.parse(code);
    
    // Render to pure SVG string
    const { svg } = await mermaid.render(id, code);
    const result = { svg };
    renderCache.set(cacheKey, result);
    return result;
  } catch (err) {
    const errMsg = (err as Error)?.message || String(err);
    const result = { svg: '', error: errMsg };
    renderCache.set(cacheKey, result);
    return result;
  }
}

// ---------------------------------------------------------
// SUBCOMPONENT: Isolated Canvas Node Render Cell (Left Col)
// ---------------------------------------------------------
interface SingleNodeCanvasProps {
  shape: string;
  applyStyles: boolean;
}

const SingleNodeCanvas = ({ shape, applyStyles }: SingleNodeCanvasProps) => {
  const nodes = useMemo(() => [
    {
      id: 'node-A',
      type: 'customNode',
      position: { x: 0, y: 0 },
      data: {
        label: shape,
        shape: shape,
        // Let CustomNode resolve default width/height from NODE_SIZE_DEFAULTS
        width: undefined,
        height: undefined,
        style: applyStyles ? {
          backgroundColor: '#fdf6e3',
          borderColor: '#b58900',
          text: {
            color: '#dc322f',
            bold: true,
            italic: true
          }
        } : undefined
      },
      selected: false,
    }
  ], [shape, applyStyles]);

  return (
    <div className="qa-cell-container">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          fitView={true}
          fitViewOptions={{ padding: 0.2 }}
          preventScrolling={true}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          panOnScroll={false}
          panOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        />
      </ReactFlowProvider>
    </div>
  );
};

// ---------------------------------------------------------
// SUBCOMPONENT: Normalized Mermaid Reference Render (Right Col)
// ---------------------------------------------------------
interface MermaidCellProps {
  code: string;
  shapeKey: string;
}

const MermaidCell = ({ code, shapeKey }: MermaidCellProps) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const cleanShapeKey = shapeKey.replace(/[^a-zA-Z0-9-]/g, '');
    const renderId = `mermaid-qa-render-${cleanShapeKey}-${Math.floor(Math.random() * 1000000)}`;

    const runRender = async () => {
      const result = await getCachedMermaidRender(renderId, code);
      if (!isMounted) {
        const tempElement = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (tempElement) tempElement.remove();
        return;
      }

      if (result.error) {
        const tempElement = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (tempElement) tempElement.remove();
        setError(result.error);
        setSvgHtml('');
      } else {
        setSvgHtml(result.svg);
        setError('');
      }
    };

    runRender();

    return () => {
      isMounted = false;
    };
  }, [code, shapeKey]);

  // ViewBox and Aspect-Ratio normalization
  useEffect(() => {
    if (!svgHtml || !svgContainerRef.current) return;

    const container = svgContainerRef.current;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Get the top-level <g> container inside the SVG
    const mainG = svgEl.querySelector('g') as SVGGraphicsElement | null;
    if (mainG) {
      try {
        const bbox = mainG.getBBox();
        const pad = 4;
        const vx = bbox.x - pad;
        const vy = bbox.y - pad;
        const vw = bbox.width + pad * 2;
        const vh = bbox.height + pad * 2;

        // Force viewport scaling while strictly preserving aspect ratio
        svgEl.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxWidth = '100%';
        svgEl.style.maxHeight = '100%';
      } catch (e) {
        console.warn('Failed to getBBox for Mermaid node in QA:', e);
      }
    }
  }, [svgHtml]);

  if (error) {
    return (
      <div className="qa-cell-container">
        <div className="qa-error-cell">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="qa-cell-container">
      <div
        ref={svgContainerRef}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: svgHtml || '<span style="color: #666; font-size: 12px;">Rendering...</span>' }}
      />
    </div>
  );
};

// ---------------------------------------------------------
// SUBCOMPONENT: Diagram Render for Arbitrary Snippet Tester
// ---------------------------------------------------------
interface SnippetCanvasProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const SnippetCanvas = ({ nodes, edges }: SnippetCanvasProps) => {
  const rfNodes = useMemo(() => {
    return nodes.map((node) => ({
      id: node.id,
      type: 'customNode',
      position: node.position,
      data: {
        label: node.label,
        shape: node.shape,
        width: node.width,
        height: node.height,
        style: node.style,
      },
    }));
  }, [nodes]);

  const rfEdges = useMemo(() => {
    return edges.map((edge) => {
      const source = edge.from.kind === 'connected' ? edge.from.nodeId : `ghostAnchor__${edge.id}__from`;
      const target = edge.to.kind === 'connected' ? edge.to.nodeId : `ghostAnchor__${edge.id}__to`;
      return {
        id: edge.id,
        source,
        target,
        sourceHandle: edge.from.kind === 'connected' ? edge.from.handleId ?? undefined : undefined,
        targetHandle: edge.to.kind === 'connected' ? edge.to.handleId ?? undefined : undefined,
        label: edge.label,
        // Standard, store-independent edge renderer
      };
    });
  }, [edges]);

  return (
    <div style={{ width: '100%', height: '240px', background: '#eaeaea', border: '1px solid #d0d2d6', borderRadius: '6px', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView={true}
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        />
      </ReactFlowProvider>
    </div>
  );
};

// ---------------------------------------------------------
// SUBCOMPONENT: Single Row in the Shapes Table (Registry Gallery)
// ---------------------------------------------------------
interface ShapeRowProps {
  shape: ShapeDefinition;
  applyStyles: boolean;
}

const ShapeRow = ({ shape, applyStyles }: ShapeRowProps) => {
  // Call production exporter on a single node to obtain exact Mermaid reference syntax
  const shapeMermaidCode = useMemo(() => {
    const diagram: CanonicalDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        {
          id: 'A',
          shape: shape.nodeShape,
          label: shape.nodeShape, // label parity
          position: { x: 0, y: 0 },
          style: applyStyles ? {
            backgroundColor: '#fdf6e3',
            borderColor: '#b58900',
            text: {
              color: '#dc322f',
              bold: true,
              italic: true
            }
          } : undefined
        }
      ],
      edges: [],
      textBoxes: []
    };
    return toMermaid(diagram);
  }, [shape, applyStyles]);

  return (
    <tr>
      <td>
        <strong>{shape.nodeShape}</strong>
      </td>
      <td>
        <span className="qa-code-badge">{shape.mermaidShape}</span>
      </td>
      <td>
        {shape.mermaidAliases.map((alias) => (
          <span className="qa-alias-badge" key={alias}>
            {alias}
          </span>
        ))}
        {shape.legacySyntax && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#666' }}>
            Legacy syntax: <code className="qa-code-badge">{shape.legacySyntax.open}...{shape.legacySyntax.close}</code>
          </div>
        )}
      </td>
      <td>
        <SingleNodeCanvas shape={shape.nodeShape} applyStyles={applyStyles} />
      </td>
      <td>
        <MermaidCell code={shapeMermaidCode} shapeKey={shape.nodeShape} />
      </td>
    </tr>
  );
};

// ---------------------------------------------------------
// MAIN PAGE COMPONENT: ShapeQAPage
// ---------------------------------------------------------
export const ShapeQAPage = () => {
  const [applyStyles, setApplyStyles] = useState(false);
  const [snippetText, setSnippetText] = useState("flowchart LR\n  A@{ shape: cyl, label: \"Database\" }");

  // Synchronously compute derived parsed snippet state to comply with react-hooks/set-state-in-effect
  const { parsedSnippet, snippetError } = useMemo(() => {
    if (!snippetText.trim()) {
      return { parsedSnippet: null, snippetError: null };
    }

    try {
      const result = importMermaidFlowchart(snippetText);
      return { parsedSnippet: result.diagram, snippetError: null };
    } catch (err) {
      return {
        parsedSnippet: null,
        snippetError: (err as Error)?.message || String(err)
      };
    }
  }, [snippetText]);

  return (
    <div className="qa-container">
      {/* 1. Header & Banner */}
      <header className="qa-header">
        <h1>Visual QA Harness</h1>
        <div className="qa-banner">
          <strong>Comparison Axis Contract:</strong> We compare <strong>shape geometry, border outlines, proportions, label placement, and orientation</strong>.
          We do <strong>NOT</strong> compare absolute pixel sizes. Square shapes must render square in both columns (verifying aspect ratio preservation).
        </div>
      </header>

      {/* 2. Global Controls */}
      <section className="qa-controls">
        <label className="qa-control-item">
          <input
            type="checkbox"
            checked={applyStyles}
            onChange={(e) => setApplyStyles(e.target.checked)}
          />
          Styled Mode (Verify background/border fills and bold/italic labels)
        </label>
      </section>

      {/* 3. Arbitrary Snippet Tester */}
      <section className="qa-tester">
        <h2>Arbitrary Snippet Tester</h2>
        <textarea
          className="qa-tester-textarea"
          value={snippetText}
          onChange={(e) => setSnippetText(e.target.value)}
          placeholder="Entrez du code Mermaid ici (ex: flowchart TD\n  A@{ shape: cyl, label: 'Db' })"
        />
        {snippetError && (
          <div style={{ color: 'red', fontSize: '13px', fontWeight: 'bold' }}>
            Parser Error: {snippetError}
          </div>
        )}
        <div className="qa-tester-preview">
          <div className="qa-tester-col">
            <span className="qa-tester-col-title">Canvas Render</span>
            {parsedSnippet ? (
              <SnippetCanvas nodes={parsedSnippet.nodes} edges={parsedSnippet.edges} />
            ) : (
              <div className="qa-cell-container" style={{ width: '100%', height: '240px' }}>
                <span style={{ color: '#666', fontSize: '12px' }}>Waiting for valid snippet...</span>
              </div>
            )}
          </div>
          <div className="qa-tester-col">
            <span className="qa-tester-col-title">Mermaid Reference</span>
            <MermaidCell code={snippetText} shapeKey="snippet" />
          </div>
        </div>
      </section>

      {/* 4. Registry shapes gallery grouped by category */}
      {SHAPE_CATEGORIES.map((category) => {
        const shapes = SHAPE_DEFINITIONS.filter((def) => def.category === category.key);
        if (shapes.length === 0) return null;

        return (
          <section className="qa-category-section" key={category.key}>
            <h2 className="qa-category-title">{category.label} ({shapes.length} shapes)</h2>
            <table className="qa-table">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Shape Key</th>
                  <th style={{ width: '15%' }}>Mermaid Shape ID</th>
                  <th style={{ width: '25%' }}>Aliases & Legacy Brackets</th>
                  <th style={{ width: '22%' }}>Canvas Render</th>
                  <th style={{ width: '23%' }}>Mermaid Render</th>
                </tr>
              </thead>
              <tbody>
                {shapes.map((shape) => (
                  <ShapeRow key={shape.nodeShape} shape={shape} applyStyles={applyStyles} />
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
};

export default ShapeQAPage;

