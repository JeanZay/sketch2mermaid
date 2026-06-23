import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { toMermaid } from '../core/mermaid';
import { useDiagramStore } from '../store/diagramStore';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { useNodes, useEdges } from '@xyflow/react';
import PropertiesPanel from './PropertiesPanel';

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
  
  const [copied, setCopied] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string>('');

  const nodes = useNodes();
  const edges = useEdges();

  const isSelectionActive = nodes.some((n) => n.selected) || edges.some((e) => e.selected);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
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

          {/* Mermaid Raw Code View */}
          <div className="code-view-wrapper">
            <pre className="code-pre">
              <code>{mermaidCode}</code>
            </pre>
          </div>
        </>
      )}

      {/* Preview header */}
      <div className="panel-header" style={{ marginTop: '16px' }}>
        <span className="panel-title">Prévisualisation SVG</span>
      </div>

      {/* SVG rendering area */}
      <div className="svg-view-wrapper">
        {error ? (
          <div className="error-container">
            <AlertCircle size={20} className="error-icon" />
            <div className="error-details">
              <span className="error-title">Erreur de syntaxe Mermaid</span>
              <p className="error-message">{error}</p>
            </div>
          </div>
        ) : svgHtml ? (
          /* 
            SECURITY EXPLANATION FOR dangerouslySetInnerHTML:
            We are using dangerouslySetInnerHTML here solely to insert the SVG string returned by mermaid.render().
            This is secure because:
            1. Mermaid is initialized globally with `securityLevel: "strict"`.
            2. All node and edge labels have been parsed and escaped character-by-character (e.g. converting " -> &quot;, # -> &#35;, etc.) prior to constructing the Mermaid code input.
            3. No remote scripts, click handlers, or arbitrary HTML tags are supported or passed into the parser.
            This meets the security guidelines of the implementation plan for controlled SVG rendering paths.
          */
          <div 
            className="mermaid-svg-container"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="empty-preview">
            Aucun diagramme à prévisualiser. Ajoutez des nœuds pour commencer.
          </div>
        )}
      </div>
    </div>
  );
};
export default PreviewPanel;
