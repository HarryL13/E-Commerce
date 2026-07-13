// Changes: Pipeline stepper — index-based done/active/pending for Image→SKU flow.
import React from 'react';
import { Check } from 'lucide-react';
import {
  PIPELINE_STEPS,
  resolvePipelineProgress,
  WorkflowBarState,
} from '../utils/workflowGuide';

type PipelineStepperProps = {
  state: WorkflowBarState;
};

export const PipelineStepper: React.FC<PipelineStepperProps> = ({ state }) => {
  const { activeStep } = resolvePipelineProgress(state);
  const activeIndex = PIPELINE_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="pipeline-stepper" aria-label="完整流程进度">
      {PIPELINE_STEPS.map((step, index) => {
        const status =
          index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
        const isLast = index === PIPELINE_STEPS.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className={`pipeline-step pipeline-step-${status}`}>
              <span className="pipeline-step-dot">
                {status === 'done' ? <Check className="w-3 h-3" /> : step.shortLabel}
              </span>
              <span className="pipeline-step-label">{step.label}</span>
            </div>
            {!isLast ? (
              <span
                className={`pipeline-connector ${
                  index < activeIndex ? 'pipeline-connector-done' : ''
                }`}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};
