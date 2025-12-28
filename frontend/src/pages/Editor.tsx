/**
 * Main 3D CAD Editor page.
 */

import { Canvas3D } from '../cad/components/Canvas3D';
import { Toolbar, useToolShortcuts } from '../cad/ui/Toolbar';
import { StatusBar } from '../cad/ui/StatusBar';
import { ChatPanel } from '../cad/ui/ChatPanel';

export function Editor() {
  // Initialize keyboard shortcuts (hook manages its own event listeners)
  useToolShortcuts();

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-900 relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 h-12 bg-slate-800/95 backdrop-blur border-b border-slate-700 flex items-center px-4 z-10">
        <h1 className="text-xl font-bold text-white">Poche</h1>
        <span className="ml-2 text-slate-400 text-sm">3D CAD Editor</span>
      </header>

      {/* Main canvas area */}
      <main className="absolute top-12 left-0 right-0 bottom-8">
        <Canvas3D showStats={false} />
      </main>

      {/* Toolbar */}
      <Toolbar />

      {/* Status bar */}
      <StatusBar />

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  );
}
