'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { STEP_ORDER } from './mock-sessions';
import type { WorkbenchStepId } from './types';

const STEP_I18N: Record<WorkbenchStepId, string> = {
  brief: 'step_brief',
  design: 'step_design',
  pdp: 'step_pdp',
  proposal: 'step_proposal',
  video: 'step_video',
  assets: 'step_assets',
  followup: 'step_followup',
};

export function WorkbenchSteps({
  activeStep,
  onStepChange,
  reachedStep,
}: {
  activeStep: WorkbenchStepId;
  onStepChange: (id: WorkbenchStepId) => void;
  /** Furthest step unlocked for this session (shell: allow all). */
  reachedStep?: WorkbenchStepId;
}) {
  const t = useTranslations('workbench');
  const activeIndex = STEP_ORDER.findIndex((s) => s.id === activeStep);
  const reachedIndex = reachedStep
    ? STEP_ORDER.findIndex((s) => s.id === reachedStep)
    : STEP_ORDER.length - 1;

  return (
    <nav
      aria-label="共创流程"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {STEP_ORDER.map((step, index) => {
        const isActive = step.id === activeStep;
        const isDone = index < activeIndex;
        const unlocked = index <= Math.max(reachedIndex, activeIndex);
        return (
          <div key={step.id} className="flex items-center gap-1">
            {index > 0 && (
              <div
                className={cn(
                  'mx-0.5 hidden h-px w-6 sm:block md:w-8',
                  index <= activeIndex ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => onStepChange(step.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm',
                isActive &&
                  'bg-primary text-primary-foreground shadow-sm',
                !isActive &&
                  isDone &&
                  'bg-primary/10 text-primary hover:bg-primary/15',
                !isActive &&
                  !isDone &&
                  unlocked &&
                  'text-muted-foreground hover:bg-muted hover:text-foreground',
                !unlocked && 'text-muted-foreground/50 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  isActive && 'bg-primary-foreground/20 text-primary-foreground',
                  !isActive && isDone && 'bg-primary text-primary-foreground',
                  !isActive && !isDone && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="size-3" /> : index + 1}
              </span>
              {t(STEP_I18N[step.id])}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
