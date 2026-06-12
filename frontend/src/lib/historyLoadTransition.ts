import type { StepId } from '../types';

export function resolveHistoryLoadTransition(currentStep: StepId, targetStep: StepId): {
  immediateStep: StepId;
  delayedStep?: StepId;
  delayMs?: number;
} {
  if (currentStep === 1 && targetStep === 5) {
    return {
      immediateStep: 4,
      delayedStep: 5,
      delayMs: 800,
    };
  }

  return {
    immediateStep: targetStep,
  };
}
