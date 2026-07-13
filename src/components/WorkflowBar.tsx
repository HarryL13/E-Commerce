// Changes: Mode-aware workflow bar — standalone hints or pipeline stepper.
import React from 'react';
import { ArrowRight, Image, Package, Search } from 'lucide-react';
import { resolveWorkflowHint, WorkflowBarState, WorkflowModule } from '../utils/workflowGuide';
import { PipelineStepper } from './PipelineStepper';

export type StudioWorkflowSnapshot = {
  selectedCount: number;
  totalImages: number;
  skuLine: 'pod' | 'bulk';
};

export type { WorkflowModule };

type WorkflowBarProps = WorkflowBarState;

const MODULE_ICONS = {
  studio: Image,
  sku: Package,
  optimizer: Search,
} as const;

export const WorkflowBar: React.FC<WorkflowBarProps> = (props) => {
  const hint = resolveWorkflowHint(props);
  const Icon = MODULE_ICONS[props.module];
  const isPipeline = props.uxMode === 'pipeline';

  return (
    <div
      className={`border-t backdrop-blur-sm ${
        isPipeline
          ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/95 to-violet-50/80'
          : 'border-zinc-200 bg-zinc-50/90'
      } min-h-[var(--studio-workflow-h,2.25rem)]`}
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-sm min-h-[var(--studio-workflow-h,2.25rem)]">
        {isPipeline ? (
          <PipelineStepper state={props} />
        ) : (
          <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isPipeline ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 shrink-0 hidden lg:inline">
              Step {hint.step}/{hint.total}
            </span>
          ) : null}

          <div className="flex-1 min-w-0">
            <p
              className={`truncate leading-snug ${
                isPipeline ? 'text-indigo-900/90' : 'text-zinc-700'
              }`}
            >
              {hint.message}
            </p>
            {hint.subMessage ? (
              <p
                className={`text-[11px] truncate leading-snug hidden sm:block ${
                  isPipeline ? 'text-indigo-600/70' : 'text-zinc-500'
                }`}
              >
                {hint.subMessage}
              </p>
            ) : null}
          </div>

          <ArrowRight
            className={`w-4 h-4 shrink-0 hidden md:block ${
              isPipeline ? 'text-indigo-400' : 'text-zinc-300'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
