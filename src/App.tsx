// Changes: Unified dark studio shell — shared header and module switcher for SKU + Image Studio.
import React, { useState } from 'react';
import SkuApp from './SkuApp';
import ImageStudioApp from './ImageStudioApp';
import { Sparkles, Image, Package } from 'lucide-react';

type Module = 'sku' | 'studio';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('sku');

  return (
    <div className="studio-root min-h-screen">
      <header className="sticky top-0 z-[100] bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight hidden sm:block">
              E-Commerce Studio
            </span>
          </div>

          <nav className="studio-tab-group">
            <button
              onClick={() => setActiveModule('sku')}
              className={`studio-tab flex items-center gap-1.5 ${activeModule === 'sku' ? 'studio-tab-active' : ''}`}
            >
              <Package className="w-3.5 h-3.5" />
              SKU Generator
            </button>
            <button
              onClick={() => setActiveModule('studio')}
              className={`studio-tab flex items-center gap-1.5 ${activeModule === 'studio' ? 'studio-tab-active' : ''}`}
            >
              <Image className="w-3.5 h-3.5" />
              Image Studio
            </button>
          </nav>
        </div>
      </header>

      {activeModule === 'sku' ? <SkuApp /> : <ImageStudioApp />}
    </div>
  );
}
