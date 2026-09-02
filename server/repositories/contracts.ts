import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, contracts, holidays } from '../db/schema';
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
  cancelled: 'Encerrado',
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
    notice: row.noticeQuantity,
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

  return db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(contracts)
      .values(values)
      .returning();
    await transaction.insert(auditLogs).values({
      entityType: 'contract',
      entityId: created.id,
      action: 'created',
      after: created,
    });
    return serializeContract(created);
  });
}
