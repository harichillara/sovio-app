import { create } from 'zustand';
import type { PresenceDaily } from '../services/presence.service';

interface PresenceState {
  todayScore: PresenceDaily | null;
  scoreHistory: PresenceDaily[];
  setTodayScore: (score: PresenceDaily) => void;
  setScoreHistory: (history: PresenceDaily[]) => void;
  reset: () => void;
}

const initialState = {
  todayScore: null as PresenceDaily | null,
  scoreHistory: [] as PresenceDaily[],
};

export const usePresenceStore = create<PresenceState>((set) => ({
  ...initialState,
  setTodayScore: (todayScore) => set({ todayScore }),
  setScoreHistory: (scoreHistory) => set({ scoreHistory }),
  reset: () => set(initialState),
}));
