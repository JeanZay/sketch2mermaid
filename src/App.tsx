import React, { Suspense } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ToastProvider } from './components/ToastProvider';
import TopNavBar from './components/TopNavBar';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PreviewPanel from './components/PreviewPanel';

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
            <Toolbar />
            
            <div className="canvas-wrapper">
              <Canvas />
            </div>

            <PreviewPanel />
          </main>
        </div>
      </ToastProvider>
    </ReactFlowProvider>
  );
}

export default App;

