import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { importMermaidFlowchartAsync } from '../core/mermaidImport';
import type { MermaidImportWarning } from '../core/mermaidImport';
import type { CanonicalDiagram } from '../core/types';

interface ImportMermaidModalProps {
  onClose: () => void;
  onImportSuccess: (diagram: CanonicalDiagram) => void;
}

const DEFAULT_PLACEHOLDER = `graph TD
  A[Début] --> B{Décision}
  B -->|Oui| C[Continuer]
  B -->|Non| D[Arrêter]`;

export const ImportMermaidModal: React.FC<ImportMermaidModalProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation state for warnings
  const [pendingDiagram, setPendingDiagram] = useState<CanonicalDiagram | null>(null);
  const [warnings, setWarnings] = useState<MermaidImportWarning[]>([]);

  // Derived state
  const isInputEmpty = useMemo(() => rawInput.trim() === '', [rawInput]);
  const hasWarnings = useMemo(() => warnings.length > 0, [warnings]);

  // Handle parse submission
  const handleParseSubmit = useCallback(async () => {
    if (isInputEmpty) return;
    setError(null);

    try {
      const result = await importMermaidFlowchartAsync(rawInput);
      
      if (result.warnings && result.warnings.length > 0) {
        setPendingDiagram(result.diagram);
        setWarnings(result.warnings);
      } else {
        // No warnings, perform transactional import immediately
        onImportSuccess(result.diagram);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur inconnue s'est produite lors de l'importation.");
      }
    }
  }, [rawInput, isInputEmpty, onImportSuccess, onClose]);

  // Proceed with import despite warnings
  const handleConfirmImport = useCallback(() => {
    if (pendingDiagram) {
      onImportSuccess(pendingDiagram);
      onClose();
    }
  }, [pendingDiagram, onImportSuccess, onClose]);

  // Go back to editor from warning confirmation screen
  const handleCancelConfirmation = useCallback(() => {
    setPendingDiagram(null);
    setWarnings([]);
  }, []);

  // Keyboard listeners: Ctrl+Enter to submit, Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!pendingDiagram) {
          handleParseSubmit();
        } else {
          handleConfirmImport();
        }
      }
    },
    [onClose, pendingDiagram, handleParseSubmit, handleConfirmImport]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content mermaid-import-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        <h3 id="import-modal-title" className="modal-title">
          {hasWarnings ? 'Avertissements d\'importation' : 'Importer depuis Mermaid'}
        </h3>

        {!hasWarnings ? (
          <>
            <p className="modal-message">
              Collez le code Mermaid de votre flowchart ci-dessous. L'importation remplacera le diagramme actuel sur le canevas.
            </p>

            <textarea
              className="mermaid-import-textarea"
              placeholder={DEFAULT_PLACEHOLDER}
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                if (error) setError(null);
              }}
              spellCheck={false}
              autoFocus
            />

            {error && (
              <div className="mermaid-import-error">
                <strong>Erreur :</strong> {error}
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={onClose}>
                Annuler
              </button>
              <button
                className="modal-btn modal-btn--confirm"
                onClick={handleParseSubmit}
                disabled={isInputEmpty}
              >
                Importer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-message">
              Le diagramme a été analysé, mais contient des éléments non supportés qui seront ignorés ou convertis. Voulez-vous continuer ?
            </p>

            <div className="mermaid-import-warnings-container">
              <ul className="mermaid-import-warnings-list">
                {warnings.map((warn, index) => (
                  <li key={index} className="mermaid-import-warning-item">
                    <span className="warning-type">[{warn.type}]</span>
                    {warn.line && <span className="warning-line"> Ligne {warn.line} :</span>}
                    <span className="warning-msg"> {warn.message}</span>
                    {warn.raw && <code className="warning-raw">({warn.raw})</code>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={handleCancelConfirmation}>
                Retour à l'édition
              </button>
              <button className="modal-btn modal-btn--confirm" onClick={handleConfirmImport}>
                Importer quand même
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
