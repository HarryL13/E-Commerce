import React, { useState } from 'react';
import SkuApp from './SkuApp';
import ImageStudioApp from './ImageStudioApp';
import { Wand2, Image, Package } from 'lucide-react';

type Module = 'sku' | 'studio';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('sku');

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Module Switcher */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900">E-Commerce Studio</span>
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-full">
            <button
              onClick={() => setActiveModule('sku')}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${activeModule === 'sku' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <Package className="w-3.5 h-3.5" />
              SKU Generator
            </button>
            <button
              onClick={() => setActiveModule('studio')}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${activeModule === 'studio' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <Image className="w-3.5 h-3.5" />
              Image Studio
            </button>
          </div>
        </div>
      </div>

      {/* Module Content */}
      {activeModule === 'sku' ? <SkuApp /> : <ImageStudioApp />}
    </div>
  );
}
