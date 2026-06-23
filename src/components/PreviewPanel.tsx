import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { toMermaid, formatMermaidExport } from '../core/mermaid';
import type { MermaidExportFormat } from '../core/types';
import { useDiagramStore } from '../store/diagramStore';
import { Copy, Check } from 'lucide-react';
import { useNodes, useEdges } from '@xyflow/react';
import PropertiesPanel from './PropertiesPanel';
import SvgPreviewViewer from './SvgPreviewViewer';
import SvgPreviewModal from './SvgPreviewModal';

// Initialize mermaid with strict security level to prevent script injections and script execution
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });
}

export const PreviewPanel = () => {
  const diagram = useDiagramStore((state) => state.diagram);
  
  // Direct live conversion to Mermaid string
  const mermaidCode = toMermaid(diagram);
  
  const [exportFormat, setExportFormat] = useState<MermaidExportFormat>('markdown');

  // Derive formatted export string based on selected format
  const formattedCode = React.useMemo(() => {
    return formatMermaidExport(mermaidCode, exportFormat);
  }, [mermaidCode, exportFormat]);
  
  const [copied, setCopied] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const nodes = useNodes();
  const edges = useEdges();

  const isSelectionActive = nodes.some((n) => n.selected) || edges.some((e) => e.selected);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!mermaidCode.trim()) {
        if (isMounted) {
          setSvgHtml('');
          setError('');
        }
        return;
      }

      // Create a unique container ID for this render cycle
      const renderId = `mermaid-render-${Math.floor(Math.random() * 100000)}`;
      try {
        // 1. Pre-parse the code to catch syntax issues early
        await mermaid.parse(mermaidCode);
        
        // 2. Render to pure SVG string
        const { svg } = await mermaid.render(renderId, mermaidCode);
        
        if (isMounted) {
          setSvgHtml(svg);
          setError('');
        }
      } catch (err) {
        console.warn('Mermaid render error caught:', err);
        
        // Clean up any temporary elements created by mermaid.render on failure
        const tempElement = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (tempElement) {
          tempElement.remove();
        }

        if (isMounted) {
          // Extract a readable error message if possible
          const errorInstance = err as Error;
          const errMsg = errorInstance?.message || 'Erreur de parsing Mermaid';
          setError(errMsg);
        }
      }
    };

    // Debounce rendering by 150ms to avoid overlapping cycles while typing node labels
    const timeoutId = setTimeout(() => {
      renderDiagram();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [mermaidCode]);

  return (
    <div className="preview-panel-container">
      {isSelectionActive ? (
        <PropertiesPanel />
      ) : (
        <>
          {/* Code panel header */}
          <div className="panel-header">
            <span className="panel-title">Code Mermaid Export</span>
            <button 
              onClick={handleCopy} 
              className="copy-button"
              title="Copier le code Mermaid dans le presse-papiers"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>

          {/* Format Selection Tabs */}
          <div className="format-tabs" role="tablist" aria-label="Format d'export Mermaid">
            <button
              type="button"
              role="tab"
              aria-selected={exportFormat === 'markdown'}
              aria-pressed={exportFormat === 'markdown'}
              className={`format-tab-btn ${exportFormat === 'markdown' ? 'active' : ''}`}
              onClick={() => setExportFormat('markdown')}
            >
              Markdown
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exportFormat === 'html'}
              aria-pressed={exportFormat === 'html'}
              className={`format-tab-btn ${exportFormat === 'html' ? 'active' : ''}`}
              onClick={() => setExportFormat('html')}
            >
              HTML / API
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exportFormat === 'raw'}
              aria-pressed={exportFormat === 'raw'}
              className={`format-tab-btn ${exportFormat === 'raw' ? 'active' : ''}`}
              onClick={() => setExportFormat('raw')}
            >
              Code Brut
            </button>
          </div>

          {/* Mermaid Raw Code View */}
          <div className="code-view-wrapper">
            <pre className="code-pre">
              <code>{formattedCode}</code>
            </pre>
          </div>
        </>
      )}

      {/* Preview header */}
      <div className="panel-header" style={{ marginTop: '16px' }}>
        <span className="panel-title">Prévisualisation SVG</span>
      </div>

      {/* SVG Preview Viewer with zoom/pan/fit */}
      <SvgPreviewViewer
        svgHtml={svgHtml}
        error={error}
        compact={true}
        showLargePreviewButton={true}
        showDownloadButton={true}
        onOpenLargePreview={() => setIsModalOpen(true)}
      />

      {/* Large preview modal */}
      {isModalOpen && svgHtml && (
        <SvgPreviewModal
          svgHtml={svgHtml}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
export default PreviewPanel;
