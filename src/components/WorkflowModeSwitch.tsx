// Changes: Workflow mode toggle — standalone vs full Image→SKU pipeline.
import React from 'react';
import { Layers, Route } from 'lucide-react';
import { WorkflowUxMode } from '../utils/workflowGuide';

type WorkflowModeSwitchProps = {
  mode: WorkflowUxMode;
  onChange: (mode: WorkflowUxMode) => void;
};

export const WorkflowModeSwitch: React.FC<WorkflowModeSwitchProps> = ({ mode, onChange }) => {
  return (
    <div className="workflow-mode-switch" role="group" aria-label="工作流模式">
      <button
        type="button"
        onClick={() => onChange('standalone')}
        className={`workflow-mode-btn ${mode === 'standalone' ? 'workflow-mode-btn-active' : ''}`}
        title="Image Studio 与 SKU Generator 各自独立使用"
      >
        <Layers className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">独立使用</span>
        <span className="sm:hidden">独立</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('pipeline')}
        className={`workflow-mode-btn ${mode === 'pipeline' ? 'workflow-mode-btn-active-pipeline' : ''}`}
        title="Image Studio → SKU Generator → 完整上架"
      >
        <Route className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">完整流程</span>
        <span className="sm:hidden">流程</span>
      </button>
    </div>
  );
};
