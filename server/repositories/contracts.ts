import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, contracts, holidays, users } from '../db/schema';
import {
  calculateDecisionDeadline,
  ContractInput,
  toBrazilianDate,
  toIsoDate,
  parseBrazilianDate,
} from '../domain/contracts';

const criticalityToDb = {
  Alta: 'high',
  Média: 'medium',
  Baixa: 'low',
} as const;
const criticalityToApi = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
} as const;
const statusToDb = {
  Vigente: 'active',
  'Em renovação': 'renewing',
  Encerrado: 'ended',
} as const;
const statusToApi = {
  active: 'Vigente',
  renewing: 'Em renovação',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
} as const;
const billingToDb = {
  Mensal: 'monthly',
  Trimestral: 'quarterly',
  Semestral: 'semiannual',
  Anual: 'annual',
  'Por uso / variável': 'usage',
  'Pagamento único': 'one_time',
} as const;
const billingToApi = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  usage: 'Por uso / variável',
  one_time: 'Pagamento único',
} as const;

type ContractRow = typeof contracts.$inferSelect;
const currentUserEmail = 'alison@webcontinental.com.br';

export function serializeContract(row: ContractRow) {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor,
    cnpj: row.cnpj,
    destination: row.destination,
    start: toBrazilianDate(row.startDate),
    end: toBrazilianDate(row.endDate),
    endDate: row.endDate,
    automatic: row.automaticRenewal,
    renewalPeriodMonths: row.renewalPeriodMonths,
    notice: row.noticeQuantity,
    noticeUnit: row.noticeUnit,
    penalty: row.cancellationPenalty,
    penaltyBase: row.penaltyBasis ?? '—',
    billing: billingToApi[row.billingFormat],
    value: Number(row.value ?? 0),
    adjustment:
      row.adjustmentIndex === 'none' ? 'Sem reajuste' : row.adjustmentIndex,
    costCenter: row.costCenter,
    squad: row.squad,
    manager: row.managerName,
    sla: row.sla ?? '',
    systems: row.integratedSystems.join(', ') || '—',
    criticality: criticalityToApi[row.criticality],
    status: statusToApi[row.status],
    lgpd: row.lgpdNotes ?? '',
  };
}

export async function listContracts() {
  const rows = await db
    .select()
    .from(contracts)
    .orderBy(asc(contracts.endDate));
  return rows.map(serializeContract);
}

export async function findContract(id: string) {
  const [row] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);
  return row ? serializeContract(row) : null;
}

export async function createContract(input: ContractInput) {
  const actorId = await findCurrentActorId();
  const values = await contractValues(input);

  return db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(contracts)
      .values(values)
      .returning();
    await transaction.insert(auditLogs).values({
      actorId,
      entityType: 'contract',
      entityId: created.id,
      action: 'created',
      after: created,
    });
    return serializeContract(created);
  });
}

export async function updateContract(id: string, input: ContractInput) {
  const current = await findContractRow(id);
  if (!current) return null;
  const actorId = await findCurrentActorId();
  const values = await contractValues(input);

  return db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(contracts)
      .set({ ...values, id, status: current.status, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    await transaction.insert(auditLogs).values({
      actorId,
      entityType: 'contract',
      entityId: id,
      action: 'updated',
      before: current,
      after: updated,
    });
    return serializeContract(updated);
  });
}

export async function cancelContract(id: string) {
  const current = await findContractRow(id);
  if (!current) return null;
  if (current.status === 'cancelled') return serializeContract(current);
  const actorId = await findCurrentActorId();

  return db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(contracts)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    await transaction.insert(auditLogs).values({
      actorId,
      entityType: 'contract',
      entityId: id,
      action: 'cancelled',
      before: current,
      after: updated,
    });
    return serializeContract(updated);
  });
}

export async function renewContract(id: string) {
  const current = await findContractRow(id);
  if (!current) return null;
  if (current.status === 'cancelled') return null;
  const actorId = await findCurrentActorId();
  const months = current.renewalPeriodMonths ?? 12;
  const newEndDate = new Date(`${current.endDate}T12:00:00Z`);
  newEndDate.setUTCMonth(newEndDate.getUTCMonth() + months);
  const endDate = toIsoDate(newEndDate);
  const decisionDeadline = calculateDecisionDeadline(
    toBrazilianDate(endDate),
    current.noticeQuantity,
    current.noticeUnit,
  );

  return db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(contracts)
      .set({
        endDate,
        decisionDeadline,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();
    await transaction.insert(auditLogs).values({
      actorId,
      entityType: 'contract',
      entityId: id,
      action: 'renewed',
      before: current,
      after: updated,
    });
    return serializeContract(updated);
  });
}

export async function listContractHistory(id: string) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
      actor: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(
      and(eq(auditLogs.entityType, 'contract'), eq(auditLogs.entityId, id)),
    )
    .orderBy(desc(auditLogs.createdAt));

  return rows.map((row) => ({
    id: row.id,
    ...historyCopy(row.action, row.before, row.after),
    actor: row.actor ?? 'Alison Martins',
    occurredAt: row.createdAt.toISOString(),
  }));
}

async function findContractRow(id: string) {
  const [row] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);
  return row ?? null;
}

async function findCurrentActorId() {
  const [actor] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, currentUserEmail))
    .limit(1);
  return actor?.id ?? null;
}

async function contractValues(input: ContractInput) {
  const holidayRows = await db.select({ date: holidays.date }).from(holidays);
  const holidaySet = new Set(holidayRows.map((holiday) => holiday.date));
  const values: typeof contracts.$inferInsert = {
    id: input.id,
    name: input.name,
    vendor: input.vendor,
    cnpj: input.cnpj,
    destination: input.destination,
    criticality: criticalityToDb[input.criticality],
    status: statusToDb[input.status],
    startDate: toIsoDate(parseBrazilianDate(input.start)),
    endDate: toIsoDate(parseBrazilianDate(input.end)),
    automaticRenewal: input.automatic,
    renewalPeriodMonths: input.automatic ? input.renewalPeriodMonths : null,
    noticeQuantity: input.notice,
    noticeUnit: input.noticeUnit,
    decisionDeadline: calculateDecisionDeadline(
      input.end,
      input.notice,
      input.noticeUnit,
      holidaySet,
    ),
    cancellationPenalty: input.penalty,
    penaltyBasis: input.penalty ? input.penaltyBase : null,
    billingFormat: billingToDb[input.billing],
    value: input.value?.toFixed(2) ?? null,
    adjustmentIndex:
      input.adjustment === 'Sem reajuste' ? 'none' : input.adjustment,
    adjustmentAnniversary:
      input.adjustment === 'Sem reajuste'
        ? null
        : toIsoDate(parseBrazilianDate(input.start)),
    costCenter: input.costCenter,
    squad: input.squad,
    managerName: input.manager,
    sla: input.sla,
    integratedSystems: input.systems,
    lgpdNotes: input.lgpd,
  };
  return values;
}

function historyCopy(action: string, before: unknown, after: unknown) {
  const beforeContract = before as Partial<ContractRow> | null;
  const afterContract = after as Partial<ContractRow> | null;
  if (action === 'created')
    return {
      action: 'Contrato cadastrado',
      detail: 'Registro criado na gestão de contratos.',
      tone: 'primary' as const,
    };
  if (action === 'updated')
    return {
      action: 'Contrato editado',
      detail: contractChanges(beforeContract, afterContract),
      tone: 'info' as const,
    };
  if (action === 'cancelled')
    return {
      action: 'Contrato cancelado',
      detail: 'O contrato foi marcado como cancelado.',
      tone: 'danger' as const,
    };
  if (action === 'renewed')
    return {
      action: 'Renovação registrada',
      detail: `Vigência alterada de ${toBrazilianDate(beforeContract?.endDate ?? '')} para ${toBrazilianDate(afterContract?.endDate ?? '')}.`,
      tone: 'success' as const,
    };
  return {
    action,
    detail: 'Ação registrada no contrato.',
    tone: 'neutral' as const,
  };
}

function contractChanges(
  before: Partial<ContractRow> | null,
  after: Partial<ContractRow> | null,
) {
  const fields: { key: keyof ContractRow; label: string }[] = [
    { key: 'name', label: 'Nome' },
    { key: 'vendor', label: 'Fornecedor' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'destination', label: 'Vertical' },
    { key: 'criticality', label: 'Criticidade' },
    { key: 'startDate', label: 'Início da vigência' },
    { key: 'endDate', label: 'Fim da vigência' },
    { key: 'automaticRenewal', label: 'Renovação automática' },
    { key: 'renewalPeriodMonths', label: 'Período de renovação' },
    { key: 'noticeQuantity', label: 'Período mínimo de aviso' },
    { key: 'noticeUnit', label: 'Unidade do aviso' },
    { key: 'cancellationPenalty', label: 'Multa por cancelamento' },
    { key: 'penaltyBasis', label: 'Base da multa' },
    { key: 'billingFormat', label: 'Formato de cobrança' },
    { key: 'value', label: 'Valor' },
    { key: 'adjustmentIndex', label: 'Índice de reajuste' },
    { key: 'costCenter', label: 'Centro de custo' },
    { key: 'squad', label: 'Setor responsável' },
    { key: 'managerName', label: 'Gestor interno' },
    { key: 'sla', label: 'SLA' },
    { key: 'integratedSystems', label: 'Sistemas integrados' },
    { key: 'lgpdNotes', label: 'Observações LGPD' },
  ];
  const changes = fields.flatMap(({ key, label }) => {
    const previous = before?.[key];
    const current = after?.[key];
    if (JSON.stringify(previous) === JSON.stringify(current)) return [];
    return [
      `${label}: ${formatHistoryValue(key, previous)} → ${formatHistoryValue(key, current)}`,
    ];
  });
  return changes.length
    ? changes.join(' • ')
    : 'Os dados cadastrais do contrato foram atualizados.';
}

function formatHistoryValue(key: keyof ContractRow, value: unknown) {
  if (value === null || value === undefined || value === '')
    return 'Não informado';
  if (key === 'startDate' || key === 'endDate')
    return toBrazilianDate(typeof value === 'string' ? value : '');
  if (key === 'automaticRenewal' || key === 'cancellationPenalty')
    return value ? 'Sim' : 'Não';
  if (key === 'value')
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  if (key === 'integratedSystems')
    return Array.isArray(value) && value.length ? value.join(', ') : 'Nenhum';
  const labels: Record<string, string> = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
    usage: 'Por uso / variável',
    one_time: 'Pagamento único',
    calendar_days: 'dias corridos',
    business_days: 'dias úteis',
    months: 'meses',
    none: 'Sem reajuste',
  };
  const serialized =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? `${value}`
      : JSON.stringify(value);
  return labels[serialized] ?? serialized;
}
