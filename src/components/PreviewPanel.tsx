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
import UserGuide from './UserGuide';

// Initialize mermaid with strict security level to prevent script injections and script execution
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });
}

export const PreviewPanel = () => {
  const diagram = useDiagramStore((state) => state.diagram);
  const rightPanelTab = useDiagramStore((state) => state.rightPanelTab);
  const setRightPanelTab = useDiagramStore((state) => state.setRightPanelTab);
  
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
          {/* Main Top Tab switcher in right panel */}
          <div className="main-panel-tabs" role="tablist" aria-label="Onglets du panneau de droite">
            <button
              type="button"
              role="tab"
              aria-selected={rightPanelTab === 'export'}
              className={`main-panel-tab-btn ${rightPanelTab === 'export' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('export')}
            >
              Export & Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightPanelTab === 'guide'}
              className={`main-panel-tab-btn ${rightPanelTab === 'guide' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('guide')}
            >
              Mode d'emploi
            </button>
          </div>

          {rightPanelTab === 'guide' ? (
            <UserGuide />
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

              {diagram.textBoxes.length > 0 && (
                <div className="annotation-info-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>
                    {diagram.textBoxes.length} visual annotation{diagram.textBoxes.length > 1 ? 's are' : ' is'} not included in Mermaid export.
                  </span>
                </div>
              )}

              {diagram.edges.filter(e => e.connectionStatus === 'detached').length > 0 && (
                <div className="annotation-info-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>
                    {diagram.edges.filter(e => e.connectionStatus === 'detached').length} detached arrow(s) are visible on the canvas but are not exported to Mermaid.
                  </span>
                </div>
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
            </>
          )}
        </>
      )}

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
