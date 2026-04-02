import { create } from 'zustand';
import type { ThreadWithMeta } from '../services/messages.service';

interface MessagesState {
  threads: ThreadWithMeta[];
  activeThreadId: string | null;
  unreadCount: number;
  setThreads: (threads: ThreadWithMeta[]) => void;
  setActiveThreadId: (id: string | null) => void;
  setUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  threads: [],
  activeThreadId: null,
  unreadCount: 0,
  setThreads: (threads) => {
    const unreadCount = threads.reduce(
      (sum, t) => sum + (t.unread_count ?? 0),
      0,
    );
    set({ threads, unreadCount });
  },
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  reset: () => set({ threads: [], activeThreadId: null, unreadCount: 0 }),
}));
