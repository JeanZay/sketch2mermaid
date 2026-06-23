import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import SvgPreviewViewer from './SvgPreviewViewer';

interface SvgPreviewModalProps {
  svgHtml: string;
  onClose: () => void;
}

/**
 * Full-viewport overlay modal for inspecting the rendered Mermaid SVG at large scale.
 * Rendered via ReactDOM.createPortal into document.body.
 *
 * - Close via X button, Escape key, or backdrop click.
 * - Embeds SvgPreviewViewer with showLargePreviewButton={false} (no nested "Large" button).
 * - Auto-fits on open via the viewer's built-in useLayoutEffect.
 */
export const SvgPreviewModal: React.FC<SvgPreviewModalProps> = ({ svgHtml, onClose }) => {
  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Backdrop click closes modal (only if click target is the backdrop itself)
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="svg-preview-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Prévisualisation SVG large"
    >
      <div className="svg-preview-modal-card">
        <button
          className="svg-preview-modal-close"
          onClick={onClose}
          title="Fermer"
          aria-label="Fermer la prévisualisation"
        >
          <X size={18} />
        </button>
        <SvgPreviewViewer
          svgHtml={svgHtml}
          compact={false}
          showLargePreviewButton={false}
          showDownloadButton={true}
        />
      </div>
    </div>,
    document.body,
  );
};

export default SvgPreviewModal;
