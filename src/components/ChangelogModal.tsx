import React, { useEffect, useCallback } from 'react';
import { CHANGELOG } from '../core/changelog';
import type { ChangelogEntry } from '../core/changelog';

interface ChangelogModalProps {
  onClose: () => void;
  mode: 'auto' | 'manual';
  unseenEntries: ChangelogEntry[];
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  onClose,
  mode,
  unseenEntries,
}) => {
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

  const entriesToDisplay = mode === 'auto' ? unseenEntries : CHANGELOG;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'feature':
        return { label: 'New', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'improvement':
        return { label: 'Improve', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'fix':
        return { label: 'Fix', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'breaking':
        return { label: 'Breaking', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'security':
        return { label: 'Security', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' };
      default:
        return { label: type, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        style={{
          maxWidth: '540px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1c1e29',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            id="changelog-modal-title"
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: '#f8fafc',
            }}
          >
            {mode === 'auto' ? "What's New in Sketch2Mermaid" : "Release Changelog"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {entriesToDisplay.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              No updates to display.
            </div>
          ) : (
            entriesToDisplay.map((entry) => (
              <div
                key={entry.version}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  paddingBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#6366f1' }}>
                    v{entry.version}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    ({entry.date})
                  </span>
                  <h4 style={{ margin: '0 0 0 4px', fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                    {entry.title}
                  </h4>
                  {entry.importance === 'major' && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Major
                    </span>
                  )}
                </div>

                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {entry.items.map((item, idx) => {
                    const badge = getTypeLabel(item.type);
                    return (
                      <li key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', lineHeight: '1.5', color: '#cbd5e1' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            minWidth: '55px',
                            textAlign: 'center',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          {badge.label}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#151821',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="modal-btn modal-btn--confirm"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
