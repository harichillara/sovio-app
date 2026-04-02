import { create } from 'zustand';
import type { Suggestion } from '../services/suggestions.service';

interface SuggestionsState {
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setActiveSuggestion: (id: string | null) => void;
  removeSuggestion: (id: string) => void;
  reset: () => void;
}

const initialState = {
  suggestions: [] as Suggestion[],
  activeSuggestionId: null as string | null,
};

export const useSuggestionsStore = create<SuggestionsState>((set) => ({
  ...initialState,
  setSuggestions: (suggestions) => set({ suggestions }),
  setActiveSuggestion: (id) => set({ activeSuggestionId: id }),
  removeSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
      activeSuggestionId:
        state.activeSuggestionId === id ? null : state.activeSuggestionId,
    })),
  reset: () => set(initialState),
}));
