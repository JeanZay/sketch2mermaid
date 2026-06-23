import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import TopNavBar from './components/TopNavBar';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PreviewPanel from './components/PreviewPanel';

export function App() {
  return (
    <ReactFlowProvider>
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
    </ReactFlowProvider>
  );
}

export default App;

