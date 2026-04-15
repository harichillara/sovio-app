import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from './queryKeys';
import * as notificationsService from '../services/notifications.service';
import type { NotificationRow } from '../services/notifications.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationRoute =
  | { pathname: '/(modals)/thread-detail'; params: { threadId: string } }
  | { pathname: '/(tabs)/home' }
  | { pathname: '/(tabs)/replay' }
  | { pathname: '/(modals)/weekly-insight' }
  | { pathname: '/(modals)/thread-detail'; params: { threadId: string; planId?: string } };

export type NotificationCenterItem = {
  id: string;
  kind: NotificationRow['kind'];
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  count: number;
  route: NotificationRoute;
};

export interface NotificationCenterState {
  items: NotificationCenterItem[];
  unreadCount: number;
  pushEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Route mapping — converts the JSONB `data` column into typed navigation routes
// ---------------------------------------------------------------------------

function resolveRoute(row: NotificationRow): NotificationRoute {
  const data = row.data ?? {};

  switch (row.kind) {
    case 'message':
      return {
        pathname: '/(modals)/thread-detail',
        params: { threadId: (data.threadId as string) ?? '' },
      };
    case 'suggestion':
      return { pathname: '/(tabs)/home' };
    case 'replay':
      return { pathname: '/(tabs)/replay' };
    case 'insight':
      return { pathname: '/(modals)/weekly-insight' };
    case 'match':
      return {
        pathname: '/(modals)/thread-detail',
        params: {
          threadId: (data.threadId as string) ?? '',
          planId: (data.planId as string) ?? undefined,
        },
      };
    default:
      return { pathname: '/(tabs)/home' };
  }
}

function groupKey(row: NotificationRow) {
  const data = row.data ?? {};
  switch (row.kind) {
    case 'message':
      return `message:${String(data.threadId ?? row.id)}`;
    case 'match':
      return `match:${String(data.threadId ?? data.planId ?? row.id)}`;
    case 'replay':
      return `replay:${row.created_at.slice(0, 10)}`;
    case 'insight':
      return `insight:${String(data.weekOf ?? row.created_at.slice(0, 10))}`;
    case 'suggestion':
      return 'suggestion';
    default:
      return `${row.kind}:${row.id}`;
  }
}

function summarizeRow(row: NotificationRow, count: number) {
  switch (row.kind) {
    case 'message':
      return {
        title: count > 1 ? 'Conversation activity picked up' : row.title,
        body: count > 1 ? `${count} unread messages. Latest: ${row.body}` : row.body,
      };
    case 'suggestion':
      return {
        title: count > 1 ? 'Fresh low-friction plans are ready' : row.title,
        body:
          count > 1
            ? `${count} new suggestions are waiting in your Intent Cloud.`
            : row.body,
      };
    case 'replay':
      return {
        title: count > 1 ? 'A few moments are worth another look' : row.title,
        body:
          count > 1
            ? `${count} replay moments are ready when you want a softer restart.`
            : row.body,
      };
    case 'insight':
      return {
        title: 'Your weekly pattern is ready',
        body: row.body,
      };
    case 'match':
      return {
        title: count > 1 ? 'People nearby are open to plans' : row.title,
        body: row.body,
      };
    default:
      return { title: row.title, body: row.body };
  }
}

function aggregateNotifications(rows: NotificationRow[]): NotificationCenterItem[] {
  const groups = new Map<
    string,
    { latest: NotificationRow; unreadCount: number; totalCount: number }
  >();

  for (const row of rows) {
    const key = groupKey(row);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        latest: row,
        unreadCount: row.read ? 0 : 1,
        totalCount: 1,
      });
      continue;
    }

    existing.totalCount += 1;
    if (!row.read) {
      existing.unreadCount += 1;
    }
  }

  return Array.from(groups.values()).map(({ latest, unreadCount, totalCount }) => {
    const summary = summarizeRow(latest, unreadCount > 0 ? unreadCount : totalCount);
    return {
      id: latest.id,
      kind: latest.kind,
      title: summary.title,
      body: summary.body,
      createdAt: latest.created_at,
      read: unreadCount === 0,
      count: unreadCount,
      route: resolveRoute(latest),
    };
  });
}

// ---------------------------------------------------------------------------
// Main hook — reads from the unified `notifications` table
// ---------------------------------------------------------------------------

export function useNotificationCenter() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.notifications(userId ?? ''),
    queryFn: async (): Promise<NotificationCenterState> => {
      if (!userId) {
        return { items: [], unreadCount: 0, pushEnabled: false };
      }

      const [rows, pushEnabled] = await Promise.all([
        notificationsService.getNotifications(userId, 40),
        notificationsService.hasPushNotificationsEnabled(userId),
      ]);

      const items = aggregateNotifications(rows);

      const unreadCount = items.reduce((sum, item) => sum + item.count, 0);

      return { items, unreadCount, pushEnabled };
    },
    enabled: !!userId,
    // Push is now the primary delivery — poll less aggressively as a fallback
    refetchInterval: 90_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useEnablePushNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      return notificationsService.registerForPushNotifications(userId);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}

export function useDisablePushNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      return notificationsService.disablePushNotifications(userId);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}

export function useMarkNotificationRead() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error('Not authenticated');
      return notificationsService.markNotificationRead(notificationId, userId);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}

export function useMarkAllNotificationsRead() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      return notificationsService.markAllNotificationsRead(userId);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      }
    },
  });
}
