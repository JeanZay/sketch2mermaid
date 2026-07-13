import React, { useState, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { areDiagramsEqual, useDiagramStore } from '../store/diagramStore';
import {
  serializeSketch2MermaidFile,
  parseSketch2MermaidFile,
  generateS2mFilename,
  MAX_FILE_SIZE_BYTES,
} from '../core/s2mFile';
import { downloadTextFile } from '../utils/downloadFile';
import { useToast } from './useToast';
import { ConfirmModal } from './ConfirmModal';
import { ImportMermaidModal } from './ImportMermaidModal';
import type { CanonicalDiagram, DiagramDirection, S2mViewport } from '../core/types';
import { autoLayoutDiagram } from '../core/layout/autoLayout';

export const TopNavBar = () => {
  const diagram = useDiagramStore((state) => state.diagram);
  const setDirection = useDiagramStore((state) => state.setDirection);
  const resetDiagram = useDiagramStore((state) => state.resetDiagram);
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const past = useDiagramStore((state) => state.past);
  const future = useDiagramStore((state) => state.future);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);

  const { getViewport, setViewport, fitView } = useReactFlow();
  const { showToast } = useToast();

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);

  // Hidden file input ref — only accessed in event handlers (not render)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser le diagramme ? Cette action effacera tout.')) {
      resetDiagram();
    }
  };

  // ---- Export .s2m ----
  const handleExport = useCallback(() => {
    try {
      const viewport = getViewport();
      const s2mViewport: S2mViewport = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      };
      const json = serializeSketch2MermaidFile(diagram, s2mViewport);
      const filename = generateS2mFilename();
      downloadTextFile(json, filename);
      showToast('Diagram exported successfully.', 'success');
    } catch (err) {
      console.error('Export failed', err);
      showToast('Export failed. Please try again.', 'error');
    }
  }, [diagram, getViewport, showToast]);

  // ---- Import .s2m ----
  const applyImport = useCallback(
    (diagramData: Parameters<typeof loadDiagram>[0], viewport?: S2mViewport, warnings?: string[]) => {
      loadDiagram(diagramData, { resetHistory: true });

      // Restore viewport after React Flow has injected the nodes
      requestAnimationFrame(() => {
        if (viewport) {
          setViewport(viewport, { duration: 0 });
        } else {
          fitView({ duration: 200 });
        }
      });

      if (warnings && warnings.length > 0) {
        showToast(warnings.join(' '), 'warning');
      } else {
        showToast('Diagram imported successfully.', 'success');
      }
    },
    [loadDiagram, setViewport, fitView, showToast],
  );

  const handleImportSuccess = useCallback(
    (importedDiagram: CanonicalDiagram) => {
      loadDiagram(importedDiagram, { resetHistory: false });
      
      requestAnimationFrame(() => {
        fitView({ duration: 200 });
      });

      showToast('Diagramme Mermaid importé avec succès.', 'success');
    },
    [loadDiagram, fitView, showToast]
  );

  const isDiagramEmpty = useCallback(() => {
    return (
      diagram.nodes.length === 0 &&
      diagram.edges.length === 0 &&
      (diagram.textBoxes?.length ?? 0) === 0
    );
  }, [diagram]);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset file input so the same file can be re-imported
      event.target.value = '';

      // Size check (UI-side)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 2 MB.`,
          'error',
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as string;
        const result = parseSketch2MermaidFile(raw);

        if (!result.ok) {
          showToast(result.error, 'error');
          return;
        }

        if (isDiagramEmpty()) {
          applyImport(result.diagram, result.viewport, result.warnings);
        } else {
          setConfirmModal({
            title: 'Replace current diagram?',
            message:
              'The current diagram will be replaced by the imported file. This action cannot be undone.',
            onConfirm: () => {
              applyImport(result.diagram, result.viewport, result.warnings);
              setConfirmModal(null);
            },
          });
        }
      };

      reader.onerror = () => {
        showToast('Failed to read the file.', 'error');
      };

      reader.readAsText(file, 'utf-8');
    },
    [applyImport, isDiagramEmpty, showToast],
  );

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const hasLayoutableContent = diagram.nodes.length > 0
    || diagram.edges.length > 0
    || diagram.textBoxes.length > 0
    || (diagram.groups?.length ?? 0) > 0;

  const handleAutoLayout = useCallback(async () => {
    if (isAutoLayouting || !hasLayoutableContent) return;
    const sourceDiagram = structuredClone(diagram);
    setIsAutoLayouting(true);

    try {
      const result = await autoLayoutDiagram(sourceDiagram);
      const currentDiagram = useDiagramStore.getState().diagram;
      if (!areDiagramsEqual(currentDiagram, sourceDiagram)) {
        showToast('Le diagramme a changé pendant le calcul. Auto-layout annulé.', 'warning');
        return;
      }

      loadDiagram(result.diagram, { resetHistory: false });
      requestAnimationFrame(() => fitView({ duration: 200 }));

      if (result.warnings.length > 0) {
        showToast(result.warnings.join(' '), 'warning');
      } else {
        showToast('Auto-layout appliqué.', 'success');
      }
    } catch (error) {
      console.error('Auto-layout failed', error);
      showToast("Impossible d'appliquer l'auto-layout.", 'error');
    } finally {
      setIsAutoLayouting(false);
    }
  }, [diagram, fitView, hasLayoutableContent, isAutoLayouting, loadDiagram, showToast]);

  const directions: { val: DiagramDirection; label: string }[] = [
    { val: 'TD', label: 'TD' },
    { val: 'LR', label: 'LR' },
    { val: 'BT', label: 'BT' },
    { val: 'RL', label: 'RL' },
  ];

  return (
    <>
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-text">Sketch2Mermaid</span>
        </div>

        <div className="nav-center-section">
          <nav className="direction-nav">
            {directions.map((d) => (
              <button
                key={d.val}
                onClick={() => setDirection(d.val)}
                className={`nav-dir-btn ${diagram.direction === d.val ? 'active' : ''}`}
                title={`Changer la direction en ${d.val}`}
              >
                {d.val}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={handleAutoLayout}
            disabled={!hasLayoutableContent || isAutoLayouting}
            className={`auto-layout-btn${!hasLayoutableContent || isAutoLayouting ? ' disabled-btn' : ''}`}
            title="Réorganiser tout le canvas selon la direction active"
            aria-label="Auto-layout du canvas"
          >
            <svg
              className={isAutoLayouting ? 'auto-layout-icon spinning' : 'auto-layout-icon'}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="6" height="6" rx="1"></rect>
              <rect x="15" y="15" width="6" height="6" rx="1"></rect>
              <path d="M9 6h3a3 3 0 0 1 3 3v6"></path>
              <path d="m12 12 3 3 3-3"></path>
            </svg>
            <span>{isAutoLayouting ? 'Layout…' : 'Auto-layout'}</span>
          </button>

          <div className="header-divider"></div>

          <div className="undo-redo-group">
            <button
              onClick={undo}
              disabled={past.length === 0}
              className={`nav-dir-btn${past.length === 0 ? ' disabled-btn' : ''}`}
              title="Undo (Ctrl+Z)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              className={`nav-dir-btn${future.length === 0 ? ' disabled-btn' : ''}`}
              title="Redo (Ctrl+Y)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="actions-right-section">
          <button 
            onClick={handleNew} 
            className="header-action-btn border-btn"
            title="Créer un nouveau diagramme vide"
          >
            New
          </button>
          <div className="header-divider"></div>
          <button
            onClick={handleExport}
            className="header-action-btn border-btn"
            title="Export .s2m file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export .s2m
          </button>
          <button
            onClick={handleImport}
            className="header-action-btn border-btn"
            title="Import .s2m file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import .s2m
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="header-action-btn border-btn"
            title="Import Mermaid flowchart code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Import Mermaid
          </button>
        </div>
      </header>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".s2m"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Confirmation modal for import overwrite */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Replace"
          cancelLabel="Cancel"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          variant="danger"
        />
      )}

      {/* Import Mermaid Modal */}
      {isImportModalOpen && (
        <ImportMermaidModal
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </>
  );
};

export default TopNavBar;
