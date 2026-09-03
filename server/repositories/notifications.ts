import { desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  notificationRules,
  notifications as notificationsTable,
} from '../db/schema';
import type { NotificationRulePatch } from '../domain/notifications';

type NotificationRow = typeof notificationsTable.$inferSelect & {
  ruleCode: string | null;
};

export async function listNotificationRules() {
  const rows = await db
    .select()
    .from(notificationRules)
    .orderBy(notificationRules.id);
  return rows.map(serializeRule);
}

export async function updateNotificationRule(
  id: number,
  patch: NotificationRulePatch,
) {
  const [row] = await db
    .update(notificationRules)
    .set({
      ...(patch.screen === undefined ? {} : { screenEnabled: patch.screen }),
      ...(patch.email === undefined ? {} : { emailEnabled: patch.email }),
      updatedAt: new Date(),
    })
    .where(eq(notificationRules.id, id))
    .returning();
  return row ? serializeRule(row) : null;
}

export async function listNotifications() {
  const rows = await db
    .select({
      id: notificationsTable.id,
      contractId: notificationsTable.contractId,
      ruleId: notificationsTable.ruleId,
      deduplicationKey: notificationsTable.deduplicationKey,
      title: notificationsTable.title,
      message: notificationsTable.message,
      scheduledAt: notificationsTable.scheduledAt,
      sentAt: notificationsTable.sentAt,
      screenSent: notificationsTable.screenSent,
      emailSent: notificationsTable.emailSent,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
      ruleCode: notificationRules.code,
    })
    .from(notificationsTable)
    .leftJoin(
      notificationRules,
      eq(notificationsTable.ruleId, notificationRules.id),
    )
    .orderBy(desc(notificationsTable.scheduledAt));
  return rows.map(serializeNotification);
}

export async function markNotificationRead(id: string) {
  const [updated] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(eq(notificationsTable.id, id))
    .returning({ id: notificationsTable.id });
  if (!updated) return null;
  const rows = await listNotifications();
  return rows.find((item) => item.id === id) ?? null;
}

export async function markAllNotificationsRead() {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(isNull(notificationsTable.readAt));
  return listNotifications();
}

function serializeRule(row: typeof notificationRules.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    screen: row.screenEnabled,
    email: row.emailEnabled,
  };
}

function serializeNotification(row: NotificationRow) {
  return {
    id: row.id,
    code: displayCode(row.title, row.ruleCode),
    title: row.title,
    text: row.message,
    when: formatTimestamp(row.scheduledAt),
    contract: row.contractId,
    tone: notificationTone(row.title, row.ruleCode),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

function displayCode(title: string, ruleCode: string | null) {
  const deadline = title.match(/D-(\d+)/)?.[1];
  if (deadline) return deadline;
  if (title.toLocaleLowerCase('pt-BR').includes('vence hoje')) return 'D0';
  if (ruleCode === 'notice_deadline') return '!';
  if (ruleCode === 'annual_adjustment') return '%';
  if (ruleCode === 'missing_document') return 'DOC';
  return '!';
}

function notificationTone(title: string, ruleCode: string | null) {
  if (
    title.toLocaleLowerCase('pt-BR').includes('vence hoje') ||
    ruleCode === 'notice_deadline'
  )
    return 'danger' as const;
  if (ruleCode === 'contract_end') return 'warning' as const;
  if (ruleCode === 'annual_adjustment') return 'info' as const;
  return 'neutral' as const;
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
    .format(value)
    .replace(',', '');
}
