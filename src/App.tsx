import React, { Suspense, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ToastProvider } from './components/ToastProvider';
import TopNavBar from './components/TopNavBar';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PreviewPanel from './components/PreviewPanel';
import { useChangelogNotification } from './hooks/useChangelogNotification';
import { ChangelogToast } from './components/ChangelogToast';
import { ChangelogModal } from './components/ChangelogModal';

// Safe tree-shaking dynamic import for the dev-only visual QA page
const ShapeQAPage = import.meta.env.DEV
  ? React.lazy(() => import('./components/ShapeQAPage'))
  : () => null;

export function App() {
  const isQA = import.meta.env.DEV && (
    window.location.pathname.endsWith('/shape-qa') || 
    window.location.hash === '#/shape-qa' ||
    window.location.search.includes('qa=shape')
  );

  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [changelogMode, setChangelogMode] = useState<'auto' | 'manual'>('manual');
  const [isDismissed, setIsDismissed] = useState(false);

  const { hasUnseen, unseenEntries, markChangelogSeen } = useChangelogNotification();

  const showToast = hasUnseen && !isDismissed;

  const handleOpenChangelog = (mode: 'auto' | 'manual') => {
    setChangelogMode(mode);
    setIsChangelogOpen(true);
    if (mode === 'auto') {
      setIsDismissed(true);
    }
  };

  const handleCloseChangelog = () => {
    setIsChangelogOpen(false);
    markChangelogSeen();
  };

  const handleDismissToast = () => {
    setIsDismissed(true);
    markChangelogSeen();
  };

  if (isQA) {
    return (
      <Suspense fallback={<div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading Visual QA Harness...</div>}>
        <ShapeQAPage />
      </Suspense>
    );
  }

  return (
    <ReactFlowProvider>
      <ToastProvider>
        <div className="app-container">
          {/* Top Header Navigation */}
          <TopNavBar />

          {/* Main Interface Layout */}
          <main className="app-body">
            <Toolbar onOpenChangelog={() => handleOpenChangelog('manual')} />
            
            <div className="canvas-wrapper">
              <Canvas />
            </div>

            <PreviewPanel />
          </main>
        </div>

        {showToast && (
          <ChangelogToast
            onOpenChangelog={() => handleOpenChangelog('auto')}
            onDismiss={handleDismissToast}
          />
        )}

        {isChangelogOpen && (
          <ChangelogModal
            mode={changelogMode}
            unseenEntries={unseenEntries}
            onClose={handleCloseChangelog}
          />
        )}
      </ToastProvider>
    </ReactFlowProvider>
  );
}

export default App;


