// Changes: Pass active flag to Optimizer so it live-refetches Shopify when tab opens.
import React, { useState, useCallback } from 'react';
import SkuApp from './SkuApp';
import ImageStudioApp from './ImageStudioApp';
import ProductOptimizerApp from './ProductOptimizerApp';
import { Sparkles, Image, Package, Search } from 'lucide-react';
import { SkuHandoff } from './utils/skuHandoff';
import { OptimizerHandoff } from './utils/optimizerHandoff';
import { WorkflowBar, StudioWorkflowSnapshot } from './components/WorkflowBar';
import { WorkflowModeSwitch } from './components/WorkflowModeSwitch';
import { FloatingHelpTab } from './components/FloatingHelpTab';
import {
  readWorkflowUxMode,
  writeWorkflowUxMode,
  WorkflowUxMode,
} from './utils/workflowGuide';

type Module = 'studio' | 'sku' | 'optimizer';

export default function App() {
  const [workflowUxMode, setWorkflowUxMode] = useState<WorkflowUxMode>(() => readWorkflowUxMode());
  const [activeModule, setActiveModule] = useState<Module>('studio');
  const [skuHandoff, setSkuHandoff] = useState<SkuHandoff | null>(null);
  const [optimizerHandoff, setOptimizerHandoff] = useState<OptimizerHandoff | null>(null);
  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowSnapshot>({
    selectedCount: 0,
    totalImages: 0,
    skuLine: 'pod',
  });
  const [optimizerPendingCount, setOptimizerPendingCount] = useState(0);

  const handleWorkflowModeChange = (mode: WorkflowUxMode) => {
    setWorkflowUxMode(mode);
    writeWorkflowUxMode(mode);
    if (mode === 'pipeline' && activeModule === 'optimizer') {
      setActiveModule('studio');
    }
  };

  const sendToSku = (handoff: SkuHandoff) => {
    setSkuHandoff(handoff);
    setActiveModule('sku');
  };

  const sendToOptimizer = (handoff: OptimizerHandoff) => {
    setOptimizerHandoff(handoff);
    setOptimizerPendingCount(handoff.images.length);
    setActiveModule('optimizer');
  };

  const onStudioWorkflowChange = useCallback((snapshot: StudioWorkflowSnapshot) => {
    setStudioWorkflow(snapshot);
  }, []);

  return (
    <div className={`studio-root min-h-screen ${workflowUxMode === 'pipeline' ? 'studio-root-pipeline' : ''}`}>
      <div className="sticky top-0 z-[100] bg-white/90 backdrop-blur-xl border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900 tracking-tight hidden md:block shrink-0">
              E-Commerce Studio
            </span>
            <WorkflowModeSwitch mode={workflowUxMode} onChange={handleWorkflowModeChange} />
          </div>

          <nav className="studio-tab-group shrink-0">
            <button
              onClick={() => setActiveModule('studio')}
              className={`studio-tab flex items-center gap-1.5 ${
                activeModule === 'studio' ? 'studio-tab-active' : ''
              } ${workflowUxMode === 'pipeline' && activeModule !== 'studio' ? 'opacity-80' : ''}`}
            >
              <Image className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Image Studio</span>
              <span className="sm:hidden">Studio</span>
            </button>
            <button
              onClick={() => setActiveModule('sku')}
              className={`studio-tab flex items-center gap-1.5 ${
                activeModule === 'sku' ? 'studio-tab-active' : ''
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SKU Generator</span>
              <span className="sm:hidden">SKU</span>
            </button>
            <button
              onClick={() => setActiveModule('optimizer')}
              className={`studio-tab flex items-center gap-1.5 ${
                activeModule === 'optimizer' ? 'studio-tab-active' : ''
              } ${workflowUxMode === 'pipeline' ? 'opacity-70' : ''}`}
              title={workflowUxMode === 'pipeline' ? '更新已有产品（独立于完整流程）' : undefined}
            >
              <Search className="w-3.5 h-3.5" />
              Optimizer
            </button>
          </nav>
        </div>

        <WorkflowBar
          uxMode={workflowUxMode}
          module={activeModule}
          studio={studioWorkflow}
          hasSkuHandoff={Boolean(skuHandoff)}
          optimizerPendingCount={optimizerPendingCount}
        />
      </div>

      <div className={activeModule === 'sku' ? '' : 'hidden'}>
        <SkuApp
          handoff={skuHandoff}
          workflowUxMode={workflowUxMode}
          onHandoffConsumed={() => setSkuHandoff(null)}
        />
      </div>
      <div className={activeModule === 'studio' ? '' : 'hidden'}>
        <ImageStudioApp
          workflowUxMode={workflowUxMode}
          onSendToSku={sendToSku}
          onSendToOptimizer={sendToOptimizer}
          onWorkflowChange={onStudioWorkflowChange}
          onGoToOptimizer={() => setActiveModule('optimizer')}
        />
      </div>
      <div className={activeModule === 'optimizer' ? '' : 'hidden'}>
        <ProductOptimizerApp
          active={activeModule === 'optimizer'}
          handoff={optimizerHandoff}
          onHandoffConsumed={() => {
            setOptimizerHandoff(null);
            setOptimizerPendingCount(0);
          }}
          onPendingCountChange={setOptimizerPendingCount}
        />
      </div>

      <FloatingHelpTab workflowUxMode={workflowUxMode} />
    </div>
  );
}
