import { create } from 'zustand';
import type { Plan } from '../supabase/types';

interface PlansState {
  activePlans: Plan[];
  suggestedPlans: Plan[];
  selectedPlanId: string | null;
  setActivePlans: (plans: Plan[]) => void;
  setSuggestedPlans: (plans: Plan[]) => void;
  setSelectedPlanId: (id: string | null) => void;
  reset: () => void;
}

export const usePlansStore = create<PlansState>((set) => ({
  activePlans: [],
  suggestedPlans: [],
  selectedPlanId: null,
  setActivePlans: (activePlans) => set({ activePlans }),
  setSuggestedPlans: (suggestedPlans) => set({ suggestedPlans }),
  setSelectedPlanId: (selectedPlanId) => set({ selectedPlanId }),
  reset: () =>
    set({ activePlans: [], suggestedPlans: [], selectedPlanId: null }),
}));
