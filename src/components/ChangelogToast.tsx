import React from 'react';

interface ChangelogToastProps {
  onOpenChangelog: () => void;
  onDismiss: () => void;
}

export const ChangelogToast: React.FC<ChangelogToastProps> = ({
  onOpenChangelog,
  onDismiss,
}) => {
  return (
    <div
      className="changelog-toast"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        backgroundColor: 'rgba(21, 24, 33, 0.95)',
        border: '1px solid rgba(99, 102, 241, 0.4)', // Indigo tinted
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        maxWidth: '360px',
        backdropFilter: 'blur(8px)',
        fontFamily: 'Inter, system-ui, sans-serif',
        animation: 'slideIn 0.3s ease-out',
        color: '#f1f5f9',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>✨</span>
          <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em', color: '#f8fafc' }}>
            Sketch2Mermaid has been updated
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
          New features and improvements are available. Review what's new in this release.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={onDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
          >
            Dismiss
          </button>
          <button
            onClick={onOpenChangelog}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(99, 102, 241, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.2)';
            }}
          >
            What's New
          </button>
        </div>
      </div>
    </div>
  );
};
