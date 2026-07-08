// Changes: Image Studio ↔ SKU Generator handoff; keep both modules mounted to preserve gallery state.
import React, { useState } from 'react';
import SkuApp from './SkuApp';
import ImageStudioApp from './ImageStudioApp';
import { Sparkles, Image, Package } from 'lucide-react';
import { SkuHandoff } from './utils/skuHandoff';

type Module = 'sku' | 'studio';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('sku');
  const [skuHandoff, setSkuHandoff] = useState<SkuHandoff | null>(null);

  const sendToSku = (handoff: SkuHandoff) => {
    setSkuHandoff(handoff);
    setActiveModule('sku');
  };

  return (
    <div className="studio-root min-h-screen">
      <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-xl border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900 tracking-tight hidden sm:block">
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

      <div className={activeModule === 'sku' ? '' : 'hidden'}>
        <SkuApp handoff={skuHandoff} onHandoffConsumed={() => setSkuHandoff(null)} />
      </div>
      <div className={activeModule === 'studio' ? '' : 'hidden'}>
        <ImageStudioApp onSendToSku={sendToSku} />
      </div>
    </div>
  );
}
