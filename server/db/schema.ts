import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', [
  'active',
  'invite_pending',
  'disabled',
]);
export const contractStatus = pgEnum('contract_status', [
  'active',
  'renewing',
  'ended',
  'cancelled',
]);
export const criticality = pgEnum('criticality', ['high', 'medium', 'low']);
export const noticeUnit = pgEnum('notice_unit', [
  'calendar_days',
  'business_days',
  'months',
]);
export const billingFormat = pgEnum('billing_format', [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'usage',
  'one_time',
]);
export const adjustmentIndex = pgEnum('adjustment_index', [
  'IPCA',
  'IGP-M',
  'INPC',
  'none',
]);
export const documentType = pgEnum('document_type', [
  'contract',
  'amendment',
  'attachment',
]);
export const decisionType = pgEnum('decision_type', [
  'renew',
  'renegotiate',
  'cancel',
  'end',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    initials: varchar('initials', { length: 4 }).notNull(),
    area: varchar('area', { length: 100 }).notNull(),
    status: userStatus('status').notNull().default('invite_pending'),
    lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_uidx').on(table.email)],
);

export const holidays = pgTable('holidays', {
  date: date('date').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  scope: varchar('scope', { length: 40 }).notNull().default('national'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contracts = pgTable(
  'contracts',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    name: varchar('name', { length: 220 }).notNull(),
    vendor: varchar('vendor', { length: 180 }).notNull(),
    cnpj: varchar('cnpj', { length: 18 }).notNull(),
    destination: varchar('destination', { length: 80 }).notNull(),
    criticality: criticality('criticality').notNull(),
    status: contractStatus('status').notNull().default('active'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    automaticRenewal: boolean('automatic_renewal').notNull().default(false),
    renewalPeriodMonths: integer('renewal_period_months'),
    noticeQuantity: integer('notice_quantity').notNull(),
    noticeUnit: noticeUnit('notice_unit').notNull().default('calendar_days'),
    decisionDeadline: date('decision_deadline').notNull(),
    cancellationPenalty: boolean('cancellation_penalty')
      .notNull()
      .default(false),
    penaltyBasis: text('penalty_basis'),
    billingFormat: billingFormat('billing_format').notNull(),
    value: numeric('value', { precision: 14, scale: 2 }),
    adjustmentIndex: adjustmentIndex('adjustment_index')
      .notNull()
      .default('none'),
    adjustmentAnniversary: date('adjustment_anniversary'),
    costCenter: varchar('cost_center', { length: 20 }).notNull(),
    squad: varchar('squad', { length: 100 }).notNull(),
    managerId: uuid('manager_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    managerName: varchar('manager_name', { length: 160 }).notNull(),
    sla: text('sla'),
    integratedSystems: text('integrated_systems')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    lgpdNotes: text('lgpd_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('contracts_cnpj_id_uidx').on(table.cnpj, table.id),
    index('contracts_status_idx').on(table.status),
    index('contracts_end_date_idx').on(table.endDate),
    index('contracts_decision_deadline_idx').on(table.decisionDeadline),
    index('contracts_manager_idx').on(table.managerId),
    check('contracts_dates_check', sql`${table.endDate} > ${table.startDate}`),
    check('contracts_notice_positive_check', sql`${table.noticeQuantity} > 0`),
    check(
      'contracts_renewal_period_check',
      sql`NOT ${table.automaticRenewal} OR ${table.renewalPeriodMonths} > 0`,
    ),
    check(
      'contracts_penalty_basis_check',
      sql`NOT ${table.cancellationPenalty} OR length(trim(${table.penaltyBasis})) > 0`,
    ),
    check(
      'contracts_value_check',
      sql`${table.value} IS NULL OR ${table.value} >= 0`,
    ),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: varchar('contract_id', { length: 32 })
      .notNull()
      .references(() => contracts.id, { onDelete: 'restrict' }),
    type: documentType('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    obsolete: boolean('obsolete').notNull().default(false),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('documents_contract_idx').on(table.contractId),
    check(
      'documents_size_check',
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 20971520`,
    ),
  ],
);

export const contractDecisions = pgTable(
  'contract_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: varchar('contract_id', { length: 32 })
      .notNull()
      .references(() => contracts.id, { onDelete: 'restrict' }),
    decision: decisionType('decision').notNull(),
    effectiveDate: date('effective_date'),
    supplierNoticeDate: date('supplier_notice_date'),
    assessedPenalty: numeric('assessed_penalty', { precision: 14, scale: 2 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('contract_decisions_contract_idx').on(table.contractId)],
);

export const notificationRules = pgTable(
  'notification_rules',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 80 }).notNull(),
    title: varchar('title', { length: 220 }).notNull(),
    description: text('description').notNull(),
    screenEnabled: boolean('screen_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(false),
    recipients: text('recipients')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    schedule: jsonb('schedule').$type<Record<string, unknown>>().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('notification_rules_code_uidx').on(table.code)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: varchar('contract_id', { length: 32 })
      .notNull()
      .references(() => contracts.id, { onDelete: 'restrict' }),
    ruleId: integer('rule_id').references(() => notificationRules.id, {
      onDelete: 'restrict',
    }),
    deduplicationKey: varchar('deduplication_key', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    screenSent: boolean('screen_sent').notNull().default(false),
    emailSent: boolean('email_sent').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('notifications_deduplication_uidx').on(table.deduplicationKey),
    index('notifications_contract_idx').on(table.contractId),
    index('notifications_read_idx').on(table.readAt),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 80 }).notNull(),
    action: varchar('action', { length: 80 }).notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_entity_idx').on(table.entityType, table.entityId),
    index('audit_created_at_idx').on(table.createdAt),
  ],
);
