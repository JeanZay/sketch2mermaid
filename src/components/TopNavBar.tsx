import React, { useState } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { toMermaid } from '../core/mermaid';
import type { DiagramDirection } from '../core/types';

export const TopNavBar = () => {
  const diagram = useDiagramStore((state) => state.diagram);
  const setDirection = useDiagramStore((state) => state.setDirection);
  const resetDiagram = useDiagramStore((state) => state.resetDiagram);

  const [copied, setCopied] = useState(false);

  const handleNew = () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser le diagramme ? Cette action effacera tout.')) {
      resetDiagram();
    }
  };

  const handleCopy = async () => {
    try {
      const code = toMermaid(diagram);
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const directions: { val: DiagramDirection; label: string }[] = [
    { val: 'TD', label: 'TD' },
    { val: 'LR', label: 'LR' },
    { val: 'BT', label: 'BT' },
    { val: 'RL', label: 'RL' },
  ];

  return (
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
      </div>

      <div className="actions-right-section">
        <button 
          onClick={handleNew} 
          className="header-action-btn border-btn"
          title="Créer un nouveau diagramme vide"
        >
          New
        </button>
        <button 
          onClick={handleCopy} 
          className="header-action-btn primary-btn"
          title="Copier le code Mermaid"
        >
          {copied ? 'Copié !' : 'Copy Mermaid'}
        </button>
        <div className="header-divider"></div>
        <button 
          className="header-action-btn disabled-btn" 
          disabled 
          title="Coming in v2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Import Mermaid
        </button>
      </div>
    </header>
  );
};

export default TopNavBar;
