import { contracts as seedContracts } from '../../app/data';
import { eq } from 'drizzle-orm';
import { closeDatabase, db } from './index';
import {
  auditLogs,
  contracts,
  holidays,
  notificationRules,
  users,
} from './schema';
import {
  calculateDecisionDeadline,
  parseBrazilianDate,
  toIsoDate,
} from '../domain/contracts';

const statusMap = {
  Vigente: 'active',
  'Em renovação': 'renewing',
  Encerrado: 'ended',
  Cancelado: 'cancelled',
} as const;
const criticalityMap = { Alta: 'high', Média: 'medium', Baixa: 'low' } as const;
const billingMap: Record<
  string,
  'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'usage' | 'one_time'
> = {
  Mensal: 'monthly',
  Trimestral: 'quarterly',
  Semestral: 'semiannual',
  Anual: 'annual',
  'Por uso / variável': 'usage',
  'Pagamento único': 'one_time',
};
const adjustmentMap: Record<string, 'IPCA' | 'IGP-M' | 'INPC' | 'none'> = {
  IPCA: 'IPCA',
  'IGP-M': 'IGP-M',
  INPC: 'INPC',
  'Sem reajuste': 'none',
};

async function seed() {
  await db
    .insert(holidays)
    .values([
      { date: '2026-01-01', name: 'Confraternização Universal' },
      { date: '2026-04-21', name: 'Tiradentes' },
      { date: '2026-05-01', name: 'Dia Mundial do Trabalho' },
      { date: '2026-09-07', name: 'Independência do Brasil' },
      { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
      { date: '2026-11-02', name: 'Finados' },
      { date: '2026-11-15', name: 'Proclamação da República' },
      {
        date: '2026-11-20',
        name: 'Dia Nacional de Zumbi e da Consciência Negra',
      },
      { date: '2026-12-25', name: 'Natal' },
    ])
    .onConflictDoNothing();

  await db
    .insert(users)
    .values([
      {
        name: 'Alison Martins',
        email: 'alison@webcontinental.com.br',
        initials: 'AM',
        area: 'Controladoria',
        vertical: 'Corporativo',
        sector: 'Controladoria',
        status: 'active',
      },
      {
        name: 'Rafael Coutinho',
        email: 'rafael.coutinho@webcontinental.com.br',
        initials: 'RC',
        area: 'Produto',
        vertical: '1P e 3P',
        sector: 'Produto',
        status: 'active',
      },
      {
        name: 'Juliana Prado',
        email: 'juliana.prado@webcontinental.com.br',
        initials: 'JP',
        area: 'Marketplace',
        vertical: '3P',
        sector: 'Marketplace',
        status: 'active',
      },
      {
        name: 'Patrícia Nunes',
        email: 'patricia.nunes@webcontinental.com.br',
        initials: 'PN',
        area: 'Jurídico',
        vertical: 'Corporativo',
        sector: 'Jurídico',
        status: 'active',
      },
      {
        name: 'Marcos Vieira',
        email: 'marcos.vieira@webcontinental.com.br',
        initials: 'MV',
        area: 'Plataforma',
        vertical: 'TI',
        sector: 'Plataforma',
        status: 'active',
      },
      {
        name: 'Ana Beatriz Lima',
        email: 'ana.lima@webcontinental.com.br',
        initials: 'AL',
        area: 'Checkout',
        vertical: '1P',
        sector: 'Checkout',
        status: 'active',
      },
      {
        name: 'Camila Ferraz',
        email: 'camila.ferraz@webcontinental.com.br',
        initials: 'CF',
        area: 'Atendimento',
        vertical: '1P e 3P',
        sector: 'Atendimento',
        status: 'invite_pending',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(contracts)
    .values(
      seedContracts.map((contract) => ({
        id: contract.id,
        name: contract.name,
        vendor: contract.vendor,
        cnpj: contract.cnpj,
        destination: contract.destination,
        criticality: criticalityMap[contract.criticality],
        status: statusMap[contract.status],
        startDate: toIsoDate(parseBrazilianDate(contract.start)),
        endDate: contract.endDate,
        automaticRenewal: contract.automatic,
        renewalPeriodMonths: contract.automatic ? 12 : null,
        noticeQuantity: contract.notice,
        noticeUnit: 'calendar_days' as const,
        decisionDeadline: calculateDecisionDeadline(
          contract.end,
          contract.notice,
          'calendar_days',
        ),
        cancellationPenalty: contract.penalty,
        penaltyBasis: contract.penalty ? contract.penaltyBase : null,
        billingFormat: billingMap[contract.billing],
        value: contract.value ? contract.value.toFixed(2) : null,
        adjustmentIndex: adjustmentMap[contract.adjustment],
        adjustmentAnniversary:
          contract.adjustment === 'Sem reajuste'
            ? null
            : toIsoDate(parseBrazilianDate(contract.start)),
        costCenter: contract.costCenter,
        squad: contract.squad,
        managerName: contract.manager,
        notificationEmails: ['gestao.contratos@webcontinental.com.br'],
        sla: contract.sla,
        integratedSystems:
          contract.systems === '—'
            ? []
            : contract.systems.split(',').map((item) => item.trim()),
        lgpdNotes: contract.lgpd,
      })),
    )
    .onConflictDoNothing();

  const [currentUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'alison@webcontinental.com.br'))
    .limit(1);
  const loggedContracts = await db
    .select({ entityId: auditLogs.entityId })
    .from(auditLogs)
    .where(eq(auditLogs.entityType, 'contract'));
  const loggedIds = new Set(loggedContracts.map((item) => item.entityId));
  const missingHistory = seedContracts.filter(
    (contract) => !loggedIds.has(contract.id),
  );
  if (missingHistory.length) {
    await db.insert(auditLogs).values(
      missingHistory.map((contract) => ({
        actorId: currentUser?.id,
        entityType: 'contract',
        entityId: contract.id,
        action: 'created',
        after: contract,
      })),
    );
  }

  await db
    .insert(notificationRules)
    .values([
      {
        code: 'contract_end',
        title: 'D-90 / D-60 / D-30 do fim da vigência',
        description: 'Alerta escalonado conforme a data de término.',
        screenEnabled: true,
        emailEnabled: true,
        recipients: ['manager'],
        schedule: {
          offsetsInDays: [90, 60, 30],
          highCriticalityExtraOffset: 120,
        },
      },
      {
        code: 'notice_deadline',
        title: 'Prazo de aviso prévio se aproximando',
        description: 'Dispara 15 dias antes da data-limite de decisão.',
        screenEnabled: true,
        emailEnabled: true,
        recipients: ['manager'],
        schedule: { offsetInDays: 15 },
      },
      {
        code: 'automatic_renewal',
        title: 'Renovação automática prestes a ocorrer',
        description: 'Avisa 7 dias antes da renovação tácita.',
        screenEnabled: true,
        emailEnabled: true,
        recipients: ['manager'],
        schedule: { offsetInDays: 7 },
      },
      {
        code: 'annual_adjustment',
        title: 'Reajuste anual aplicado',
        description: 'Na data de aniversário, com o índice do contrato.',
        screenEnabled: true,
        emailEnabled: false,
        recipients: ['manager'],
        schedule: { offsetInDays: 0 },
      },
      {
        code: 'missing_document',
        title: 'Documento obrigatório ausente',
        description: 'Contrato sem PDF assinado após 5 dias do cadastro.',
        screenEnabled: true,
        emailEnabled: false,
        recipients: ['manager'],
        schedule: { daysAfterCreation: 5 },
      },
    ])
    .onConflictDoNothing();

  await db.update(notificationRules).set({ recipients: ['manager'] });
}

void seed()
  .then(() => console.log('Banco local populado com sucesso.'))
  .catch((error: unknown) => {
    console.error('Falha ao popular o banco local.', error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
