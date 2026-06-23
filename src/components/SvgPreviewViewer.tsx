import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Download, Minimize2, AlertCircle, FileCode2 } from 'lucide-react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;
const FIT_PADDING = 32;

interface SvgPreviewViewerProps {
  svgHtml: string;
  error?: string;
  compact?: boolean;
  showLargePreviewButton?: boolean;
  showDownloadButton?: boolean;
  onOpenLargePreview?: () => void;
}

/**
 * Self-contained SVG viewer with zoom, pan, fit-to-view, and download.
 * All view state (zoom, pan) is local — never stored in the diagram store.
 *
 * Transform model:
 *   transform-origin: 0 0
 *   transform: translate(panX, panY) scale(zoom)
 *
 * Fit computes explicit centering:
 *   panX = (viewportW - svgW * scale) / 2
 *   panY = (viewportH - svgH * scale) / 2
 */
export const SvgPreviewViewer: React.FC<SvgPreviewViewerProps> = ({
  svgHtml,
  error,
  compact = true,
  showLargePreviewButton = true,
  showDownloadButton = true,
  onOpenLargePreview,
}) => {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // ---- Fit-to-view ----
  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const inner = innerRef.current;
    if (!viewport || !inner) return;

    const svgEl = inner.querySelector('svg') as SVGSVGElement | null;
    if (!svgEl) return;

    const viewportRect = viewport.getBoundingClientRect();
    const viewportWidth = viewportRect.width;
    const viewportHeight = viewportRect.height;

    // Get the SVG's natural pixel dimensions (CSS layout, unaffected by parent transforms)
    const svgNaturalWidth = svgEl.clientWidth;
    const svgNaturalHeight = svgEl.clientHeight;

    if (svgNaturalWidth <= 0 || svgNaturalHeight <= 0) return;

    // Use getBBox() to get the tight bounding box of actual diagram content,
    // excluding Mermaid's internal whitespace padding in the viewBox.
    // Then convert from SVG coordinate space to pixel space for accurate fit.
    let fitWidth = svgNaturalWidth;
    let fitHeight = svgNaturalHeight;
    let offsetX = 0;
    let offsetY = 0;

    try {
      const bbox = svgEl.getBBox();
      const vb = svgEl.viewBox?.baseVal;

      if (vb && vb.width > 0 && vb.height > 0 && bbox.width > 0 && bbox.height > 0) {
        // Scale factor from SVG coordinate space to pixel space
        const sx = svgNaturalWidth / vb.width;
        const sy = svgNaturalHeight / vb.height;

        fitWidth = bbox.width * sx;
        fitHeight = bbox.height * sy;
        offsetX = (bbox.x - vb.x) * sx;
        offsetY = (bbox.y - vb.y) * sy;
      }
    } catch {
      // getBBox() can throw if SVG is not rendered yet; fall back to full dimensions
    }

    const availW = viewportWidth - FIT_PADDING * 2;
    const availH = viewportHeight - FIT_PADDING * 2;

    const scale = Math.max(
      MIN_ZOOM,
      Math.min(
        Math.min(availW / fitWidth, availH / fitHeight),
        MAX_ZOOM,
      ),
    );

    // Center on the actual content area, accounting for its offset within the SVG
    const newPanX = (viewportWidth - fitWidth * scale) / 2 - offsetX * scale;
    const newPanY = (viewportHeight - fitHeight * scale) / 2 - offsetY * scale;

    setZoom(scale);
    setPanX(newPanX);
    setPanY(newPanY);
  }, []);

  // Auto-fit when SVG content changes (after the SVG is mounted and measurable)
  useLayoutEffect(() => {
    if (!svgHtml) return;
    // Use requestAnimationFrame to ensure the SVG element is fully laid out before measuring
    const rafId = requestAnimationFrame(() => {
      fitToView();
    });
    return () => cancelAnimationFrame(rafId);
  }, [svgHtml, fitToView]);

  // Re-fit on viewport resize via ResizeObserver
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !svgHtml) return;

    const observer = new ResizeObserver(() => {
      // Re-run fit whenever the viewport dimensions change
      requestAnimationFrame(() => {
        fitToView();
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [svgHtml, fitToView]);

  // ---- Zoom controls ----
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  // ---- Pan / drag with pointer capture ----
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary button (left click)
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
  }, [panX, panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanX(dragStartRef.current.panX + dx);
    setPanY(dragStartRef.current.panY + dy);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
      setIsPanning(false);
    }
  }, []);

  // ---- Download SVG ----
  const handleDownload = useCallback(() => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgHtml]);

  const zoomPercent = Math.round(zoom * 100);

  // ---- Empty state ----
  if (!svgHtml && !error) {
    return (
      <div className={`svg-preview-viewer ${compact ? 'compact' : ''}`}>
        <div className="svg-empty-state">
          <FileCode2 size={32} className="svg-empty-icon" />
          <span className="svg-empty-text">
            Aucun diagramme à prévisualiser.
          </span>
          <span className="svg-empty-hint">
            Ajoutez des nœuds pour commencer.
          </span>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className={`svg-preview-viewer ${compact ? 'compact' : ''}`}>
        <div className="svg-error-state">
          <AlertCircle size={22} className="svg-error-icon" />
          <div className="svg-error-details">
            <span className="svg-error-title">Erreur de syntaxe Mermaid</span>
            <p className="svg-error-message">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Normal state with SVG ----
  return (
    <div className={`svg-preview-viewer ${compact ? 'compact' : ''}`}>
      {/* Toolbar */}
      <div className="svg-preview-toolbar">
        <button
          className="svg-toolbar-btn"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom arrière"
        >
          <ZoomOut size={14} />
        </button>
        <span className="svg-toolbar-zoom-label">{zoomPercent}%</span>
        <button
          className="svg-toolbar-btn"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom avant"
        >
          <ZoomIn size={14} />
        </button>

        <div className="svg-toolbar-separator" />

        <button
          className="svg-toolbar-btn"
          onClick={fitToView}
          title="Ajuster à la vue"
        >
          <Minimize2 size={14} />
          <span>Fit</span>
        </button>

        {showLargePreviewButton && onOpenLargePreview && (
          <button
            className="svg-toolbar-btn"
            onClick={onOpenLargePreview}
            title="Prévisualisation large"
          >
            <Maximize2 size={14} />
          </button>
        )}

        {showDownloadButton && (
          <button
            className="svg-toolbar-btn"
            onClick={handleDownload}
            title="Télécharger le SVG"
          >
            <Download size={14} />
          </button>
        )}
      </div>

      {/* Viewport (pan/zoom area) */}
      <div
        ref={viewportRef}
        className={`svg-viewport ${isPanning ? 'is-panning' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/*
          SECURITY EXPLANATION FOR dangerouslySetInnerHTML:
          We are using dangerouslySetInnerHTML here solely to insert the SVG string returned by mermaid.render().
          This is secure because:
          1. Mermaid is initialized globally with `securityLevel: "strict"`.
          2. All node and edge labels have been parsed and escaped character-by-character
             (e.g. converting " -> &quot;, # -> &#35;, etc.) prior to constructing the Mermaid code input.
          3. No remote scripts, click handlers, or arbitrary HTML tags are supported or passed into the parser.
          This meets the security guidelines of the implementation plan for controlled SVG rendering paths.
        */}
        <div
          ref={innerRef}
          className="svg-inner"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    </div>
  );
};

export default SvgPreviewViewer;
