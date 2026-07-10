// Changes: Global workflow step hint — guides Image Studio → SKU / Optimizer pipeline.
import React from 'react';
import { ArrowRight, Image, Package, Search } from 'lucide-react';

export type StudioWorkflowSnapshot = {
  selectedCount: number;
  totalImages: number;
  skuLine: 'pod' | 'bulk';
};

export type WorkflowModule = 'studio' | 'sku' | 'optimizer';

type WorkflowBarProps = {
  module: WorkflowModule;
  studio?: StudioWorkflowSnapshot;
  hasSkuHandoff?: boolean;
  optimizerPendingCount?: number;
};

export const WorkflowBar: React.FC<WorkflowBarProps> = ({
  module,
  studio,
  hasSkuHandoff,
  optimizerPendingCount = 0,
}) => {
  let step = 1;
  let total = 4;
  let message = '';
  let Icon = Image;

  if (module === 'studio') {
    Icon = Image;
    const selected = studio?.selectedCount ?? 0;
    const totalImages = studio?.totalImages ?? 0;
    const line = studio?.skuLine === 'bulk' ? '大货' : 'POD';

    if (totalImages === 0) {
      step = 1;
      message = 'Generate product images above (Multi-View, Background, Scene…)';
    } else if (selected === 0) {
      step = 2;
      message = `${totalImages} image(s) ready — select below (click order = carousel, 1st = hero)`;
    } else {
      step = 3;
      message = `${selected} selected · ${line} · Next: Generate SKU (new product) or Push to Optimizer (replace live images)`;
    }
  } else if (module === 'sku') {
    Icon = Package;
    step = hasSkuHandoff ? 3 : 2;
    message = hasSkuHandoff
      ? 'Review AI listing, variants & inventory → Publish Draft to Shopify'
      : 'Upload images or import from Image Studio Shared History';
  } else {
    Icon = Search;
    step = optimizerPendingCount > 0 ? 3 : 2;
    message =
      optimizerPendingCount > 0
        ? `${optimizerPendingCount} studio image(s) pending — search product → Save + Replace Images`
        : 'Search live Shopify products to edit listing or replace gallery';
  }

  return (
    <div className="border-t border-indigo-100 bg-indigo-50/90 backdrop-blur-sm h-[var(--studio-workflow-h,2.25rem)]">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-3 text-sm">
        <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 shrink-0">
          Step {step}/{total}
        </span>
        <span className="text-indigo-900/90 truncate flex-1">{message}</span>
        <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 hidden sm:block" />
      </div>
    </div>
  );
};
