import { create } from 'zustand';

interface AIState {
  tokensUsed: number;
  tokensLimit: number;
  isGenerating: boolean;
  setTokensUsed: (count: number) => void;
  setTokensLimit: (limit: number) => void;
  setIsGenerating: (generating: boolean) => void;
  reset: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  tokensUsed: 0,
  tokensLimit: 100, // free tier default
  isGenerating: false,
  setTokensUsed: (tokensUsed) => set({ tokensUsed }),
  setTokensLimit: (tokensLimit) => set({ tokensLimit }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  reset: () => set({ tokensUsed: 0, tokensLimit: 100, isGenerating: false }),
}));
