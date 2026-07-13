// Changes: Two UX modes — standalone (per-module) vs pipeline (Image → SKU → publish).
export type WorkflowUxMode = 'standalone' | 'pipeline';

export const WORKFLOW_UX_MODE_KEY = 'ecs_workflow_ux_mode';

export function readWorkflowUxMode(): WorkflowUxMode {
  try {
    const saved = localStorage.getItem(WORKFLOW_UX_MODE_KEY);
    return saved === 'pipeline' ? 'pipeline' : 'standalone';
  } catch {
    return 'standalone';
  }
}

export function writeWorkflowUxMode(mode: WorkflowUxMode): void {
  try {
    localStorage.setItem(WORKFLOW_UX_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export type WorkflowModule = 'studio' | 'sku' | 'optimizer';

export type PipelineStepId = 'generate' | 'select' | 'sku' | 'publish';

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  shortLabel: string;
};

export const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'generate', label: '出图', shortLabel: '1' },
  { id: 'select', label: '选图', shortLabel: '2' },
  { id: 'sku', label: '生成 SKU', shortLabel: '3' },
  { id: 'publish', label: '发布', shortLabel: '4' },
];

export type WorkflowBarState = {
  uxMode: WorkflowUxMode;
  module: WorkflowModule;
  studio?: {
    selectedCount: number;
    totalImages: number;
    skuLine: 'pod' | 'bulk';
  };
  hasSkuHandoff?: boolean;
  optimizerPendingCount?: number;
};

export type WorkflowHint = {
  step: number;
  total: number;
  message: string;
  subMessage?: string;
};

export type PipelineProgress = {
  activeStep: PipelineStepId;
};

export function resolvePipelineProgress(state: WorkflowBarState): PipelineProgress {
  const { module, studio, hasSkuHandoff } = state;
  const totalImages = studio?.totalImages ?? 0;
  const selected = studio?.selectedCount ?? 0;

  if (module === 'sku') {
    return { activeStep: hasSkuHandoff ? 'publish' : 'sku' };
  }

  if (totalImages === 0) {
    return { activeStep: 'generate' };
  }

  if (selected > 0) {
    return { activeStep: 'select' };
  }

  return { activeStep: 'select' };
}

export function resolveWorkflowHint(state: WorkflowBarState): WorkflowHint {
  const { uxMode, module, studio, hasSkuHandoff } = state;

  if (uxMode === 'pipeline') {
    const progress = resolvePipelineProgress(state);
    const stepIndex = PIPELINE_STEPS.findIndex((s) => s.id === progress.activeStep) + 1;

    if (module === 'studio') {
      const totalImages = studio?.totalImages ?? 0;
      const selected = studio?.selectedCount ?? 0;
      const line = studio?.skuLine === 'bulk' ? '大货' : 'POD';

      if (totalImages === 0) {
        return {
          step: 1,
          total: 4,
          message: '完整流程 Step 1 — 在上方生成产品图（推荐 Multi-View + SKU 底图）',
        };
      }
      if (selected === 0) {
        return {
          step: 2,
          total: 4,
          message: `完整流程 Step 2 — ${totalImages} 张已就绪，在 Shared History 按顺序勾选`,
          subMessage: '第 1 张 = 主图，然后点击「继续生成 SKU」',
        };
      }
      return {
        step: 2,
        total: 4,
        message: `已选 ${selected} 张 · ${line} — 点击「继续生成 SKU」进入下一步`,
      };
    }

    if (module === 'sku') {
      if (hasSkuHandoff) {
        return {
          step: stepIndex,
          total: 4,
          message: '完整流程 Step 4 — 检查 listing、变体、库存 → Publish Draft',
          subMessage: '完成后到 Shopify Admin 设为 Active',
        };
      }
      return {
        step: 3,
        total: 4,
        message: '完整流程 Step 3 — 上传图片或从 Studio 推送，生成完整 SKU',
      };
    }

    return {
      step: 1,
      total: 4,
      message: 'Optimizer 用于更新已有产品，完整新建流程请切回 Image Studio',
    };
  }

  // Standalone mode
  if (module === 'studio') {
    const totalImages = studio?.totalImages ?? 0;
    return {
      step: 1,
      total: 1,
      message:
        totalImages > 0
          ? `独立使用 — ${totalImages} 张图在 Shared History，可继续生成或导出`
          : '独立使用 — 生成产品图（Multi-View / Background / Scene / Logo），无需进入 SKU',
    };
  }

  if (module === 'sku') {
    return {
      step: 1,
      total: 1,
      message: hasSkuHandoff
        ? '独立使用 — 已导入 Studio 图片，检查 listing 后可发布或导出 CSV'
        : '独立使用 — 上传图片直接生成 SKU listing，也可从 Shared History 导入',
    };
  }

  const pending = state.optimizerPendingCount ?? 0;
  return {
    step: 1,
    total: 1,
    message:
      pending > 0
        ? `独立使用 — ${pending} 张 Studio 图片待替换到 Shopify 产品`
        : '独立使用 — 搜索并编辑已有 Shopify 产品',
  };
}

export type HelpSection = {
  id: string;
  title: string;
  steps?: string[];
  bullets?: string[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'standalone',
    title: '独立使用',
    bullets: [
      'Image Studio — 单独出图、管理 Shared History',
      'SKU Generator — 单独上传图片生成 listing',
      '两个模块可分开用，不强制串联',
    ],
  },
  {
    id: 'pipeline',
    title: '完整流程（Image → SKU → 上架）',
    steps: [
      'Image Studio 生成产品图',
      'Shared History 按序勾选（第 1 张 = 主图）',
      '继续生成 SKU → SKU Generator 自动生成 listing',
      '检查变体与库存（默认 1000）→ Publish Draft',
    ],
  },
  {
    id: 'studio',
    title: 'Image Studio 功能',
    bullets: [
      'Multi-View — 多角度 + JuJuBit SKU 黑白底图',
      'Background / Scene Gen / Logo Brand',
      'Shared History 跨 tab 共享',
    ],
  },
  {
    id: 'sku',
    title: 'SKU Generator',
    bullets: [
      'POD：FIG-POD-{size}',
      '大货：{code}-REG-{size}',
      '默认库存 1000，可 CSV 或 Publish',
    ],
  },
  {
    id: 'optimizer',
    title: 'Product Optimizer（更新已有）',
    bullets: [
      '搜索 Shopify 产品并编辑 listing',
      'Replace Images 替换线上图库',
      '独立于新建流程，按需使用',
    ],
  },
];
