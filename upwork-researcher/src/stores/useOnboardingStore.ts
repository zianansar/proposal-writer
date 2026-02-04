import { create } from "zustand";

// Review Fix #4, #5: Removed unused voiceFiles and apiKey state
// - voiceFiles: Placeholder for Epic 6 voice learning feature
// - apiKey: Already persisted via Tauri set_api_key, redundant to store in memory
interface OnboardingState {
  currentStep: number;
  showOnboarding: boolean;
  setCurrentStep: (step: number) => void;
  setShowOnboarding: (show: boolean) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  showOnboarding: false,
  setCurrentStep: (step) => set({ currentStep: step }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
  reset: () => set({ currentStep: 1 }),
}));
