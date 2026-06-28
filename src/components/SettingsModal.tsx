import React, { useState, useEffect, useCallback } from 'react';
import { SHAPE_DEFINITIONS, getShapeCapabilities } from '../core/shapeRegistry';
import { APP_VERSION } from '../core/config';

interface SettingsModalProps {
  onClose: () => void;
  onOpenChangelog: () => void;
}

type TabType = 'general' | 'capabilities' | 'semantics';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onOpenChangelog }) => {
  const [activeTab, setActiveTab] = useState<TabType>('capabilities');

  // Keyboard listener: Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="settings-tab-pane">
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#f1f5f9' }}>General Info</h4>
            <p className="modal-message" style={{ margin: 0, lineHeight: 1.5, color: '#cbd5e1' }}>
              Sketch2Mermaid is configured for standard Mermaid flowchart visualization.
              All shapes and sizes are optimized to map directly to standard Mermaid rendering formats.
            </p>
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '6px', background: '#151821', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#94a3b8' }}>
                <span>App Version</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#f1f5f9' }}>v{APP_VERSION}</span>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChangelog();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: 0,
                      textDecoration: 'underline',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6366f1')}
                  >
                    What's New
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>
                <span>Mermaid Compatibility</span>
                <span style={{ fontWeight: 'bold', color: '#f1f5f9' }}>v11.x</span>
              </div>
            </div>
          </div>
        );

      case 'capabilities':
        return (
          <div className="settings-tab-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#f1f5f9' }}>Shape Capabilities</h4>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                Read-only semantic registry
              </span>
            </div>
            <p className="modal-message" style={{ marginBottom: '16px', fontSize: '12px', lineHeight: 1.4, color: '#94a3b8' }}>
              Some Mermaid shapes are structural symbols rather than text containers. Sketch2Mermaid keeps their behavior explicit so the canvas remains visually useful while Mermaid export stays clean.
            </p>

            <div 
              style={{ 
                maxHeight: '280px', 
                overflowY: 'auto', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                borderRadius: '6px',
                background: '#151821'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#1c202e', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>ID</th>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>Display Name</th>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>Mermaid Shape</th>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>Supports Label</th>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>Sizing Mode</th>
                    <th style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>Fixed Size</th>
                  </tr>
                </thead>
                <tbody>
                  {SHAPE_DEFINITIONS.map((def) => {
                    const caps = getShapeCapabilities(def.nodeShape);
                    return (
                      <tr 
                        key={def.nodeShape} 
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
                        className="settings-table-row"
                      >
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>{def.nodeShape}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>{def.uiLabel}</td>
                        <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{def.mermaidShape}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span 
                            style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '10px', 
                              fontWeight: 'bold',
                              background: caps.supportsLabel ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                              color: caps.supportsLabel ? '#4caf50' : '#ef4444'
                            }}
                          >
                            {caps.supportsLabel ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textTransform: 'capitalize', color: '#cbd5e1' }}>{caps.sizingMode}</td>
                        <td style={{ padding: '8px 12px', color: caps.fixedSize ? '#f1f5f9' : '#64748b' }}>
                          {caps.fixedSize ? `${caps.fixedSize.width} × ${caps.fixedSize.height}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'semantics':
        return (
          <div className="settings-tab-pane">
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#f1f5f9' }}>About Export Semantics</h4>
            <div style={{ lineHeight: 1.5, color: '#cbd5e1', fontSize: '13px' }}>
              <p style={{ marginTop: 0 }}>
                In Mermaid, structural flowchart elements like **junctions**, **forks**, or **joins** are parsed and rendered purely as visual nodes without labels. Adding labels to these elements is not supported by the Mermaid engine.
              </p>
              <p>
                To provide a high-fidelity visual authoring experience, Sketch2Mermaid:
              </p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0', color: '#cbd5e1' }}>
                <li style={{ marginBottom: '6px' }}>Enforces strict fixed sizing on canvas so labels cannot distort shape layout.</li>
                <li style={{ marginBottom: '6px' }}>Hides all visual text-style options for label-less shapes in the properties sidebar.</li>
                <li style={{ marginBottom: '6px' }}>Outputs clean syntax declarations (e.g. <code>A@&#123; shape: f-circ &#125;</code>) in Mermaid export to ensure zero syntax noise.</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '650px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <h3 id="settings-modal-title" className="modal-title" style={{ margin: '0 0 16px 0', color: '#f1f5f9' }}>
          Application Settings
        </h3>

        {/* Tab Headers */}
        <div 
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
            marginBottom: '16px',
            gap: '8px'
          }}
        >
          <button
            className={`settings-tab-btn ${activeTab === 'capabilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('capabilities')}
          >
            Shape Capabilities
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`settings-tab-btn ${activeTab === 'semantics' ? 'active' : ''}`}
            onClick={() => setActiveTab('semantics')}
          >
            Export Semantics
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, minHeight: '300px' }}>
          {renderContent()}
        </div>

        {/* Footer Actions */}
        <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          <button className="modal-btn modal-btn--confirm" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
