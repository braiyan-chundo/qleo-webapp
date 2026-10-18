import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/tasks/services/tasks.service', () => ({
  tasksService: { getById: vi.fn(async () => ({ projectId: 'p-resolved' })) },
}));

import type { Notification } from '../services/notifications.service';
import { resolveNotificationHref, REMINDERS_ROUTE } from './notification-nav';

function reminderNotification(extra: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'REMINDER',
    read: false,
    taskId: null,
    projectId: null,
    commentId: null,
    requestedDate: null,
    reason: 'Llamar al proveedor',
    actor: null,
    project: null,
    task: null,
    createdAt: '2026-10-19T15:00:00Z',
    ...extra,
  };
}

describe('resolveNotificationHref · REMINDER (HU-0202)', () => {
  it('sin tarea abre /recordatorios (AC-15, AC-17)', async () => {
    expect(await resolveNotificationHref(reminderNotification())).toBe(REMINDERS_ROUTE);
    expect(REMINDERS_ROUTE).toBe('/recordatorios');
  });

  it('con tarea abre la tarea (AC-16, AC-17)', async () => {
    expect(
      await resolveNotificationHref(reminderNotification({ taskId: 't1', projectId: 'p1' })),
    ).toBe('/projects/p1/tasks/t1');
  });
});
