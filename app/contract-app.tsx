'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Gauge,
  Info,
  Plus,
  Search,
  Settings2,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Contract,
  contracts as seedContracts,
  daysUntil,
  decisionDate,
  formatDate,
  money,
  notifications,
  TODAY,
  users,
} from './data';
import { contractPayload, createContract, fetchContracts } from './api';

type View =
  | 'dashboard'
  | 'contracts'
  | 'detail'
  | 'new'
  | 'notifications'
  | 'calendar'
  | 'rules'
  | 'access';
type Tone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

const pageTitles: Record<View, [string, string]> = {
  dashboard: ['Visão geral', 'Painel de contratos'],
  contracts: ['Contratos', 'Todos os contratos'],
  detail: ['Contratos', 'Detalhe do contrato'],
  new: ['Contratos', 'Novo contrato'],
  notifications: ['Notificações', 'Central de notificações'],
  calendar: ['Calendário', 'Vencimentos e prazos'],
  rules: ['Configurações', 'Regras de notificação'],
  access: ['Configurações', 'Gestão de acesso'],
};

const navItems = [
  ['dashboard', 'Painel', Gauge],
  ['contracts', 'Contratos', FileText],
  ['calendar', 'Calendário', CalendarDays],
  ['notifications', 'Notificações', Bell],
  ['rules', 'Regras', Settings2],
  ['access', 'Acessos', Users],
] as const;

const ruleSeed = [
  [
    'D-90 / D-60 / D-30 do fim da vigência',
    'Alerta escalonado conforme a data de término.',
    'Gestor + Jurídico',
    true,
    true,
  ],
  [
    'Prazo de aviso prévio se aproximando',
    'Dispara 15 dias antes da data-limite de decisão.',
    'Gestor do contrato',
    true,
    true,
  ],
  [
    'Renovação automática prestes a ocorrer',
    'Avisa 7 dias antes da renovação tácita.',
    'Gestor + Financeiro',
    true,
    true,
  ],
  [
    'Reajuste anual aplicado',
    'Na data de aniversário, com o índice do contrato.',
    'Financeiro',
    true,
    false,
  ],
  [
    'Documento obrigatório ausente',
    'Contrato sem PDF assinado após 5 dias do cadastro.',
    'Gestor do contrato',
    true,
    false,
  ],
] as const;

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function toneForStatus(status: Contract['status']): Tone {
  return status === 'Vigente'
    ? 'success'
    : status === 'Em renovação'
      ? 'warning'
      : 'neutral';
}

function toneForCriticality(value: Contract['criticality']): Tone {
  return value === 'Alta'
    ? 'danger'
    : value === 'Média'
      ? 'warning'
      : 'neutral';
}

export default function ContractApp() {
  const [view, setView] = useState<View>('dashboard');
  const [contractItems, setContractItems] = useState<Contract[]>(seedContracts);
  const [selectedId, setSelectedId] = useState(seedContracts[0].id);
  const [detailTab, setDetailTab] = useState<
    'summary' | 'documents' | 'history'
  >('summary');
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<
    'Não lidas' | 'Todas'
  >('Não lidas');
  const [month, setMonth] = useState(8);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [autoRenew, setAutoRenew] = useState(true);
  const [hasPenalty, setHasPenalty] = useState(false);
  const [rules, setRules] = useState(
    ruleSeed.map(([title, description, recipients, screen, email]) => ({
      title,
      description,
      recipients,
      screen,
      email,
    })),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchContracts(controller.signal)
      .then((items) => setContractItems(items))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const selected =
    contractItems.find((contract) => contract.id === selectedId) ??
    contractItems[0] ??
    seedContracts[0];
  const unread = notifications.length - readIds.length;
  const navView = view === 'detail' || view === 'new' ? 'contracts' : view;
  const openContract = (id: string) => {
    setSelectedId(id);
    setDetailTab('summary');
    setView('detail');
  };
  const showToast = (title: string, text: string) => {
    setToast({ title, text });
    window.setTimeout(() => setToast(null), 3600);
  };

  const filteredContracts = useMemo(
    () =>
      contractItems.filter((contract) => {
        const query = search.trim().toLocaleLowerCase('pt-BR');
        const matchesSearch =
          !query ||
          `${contract.name} ${contract.vendor} ${contract.id}`
            .toLocaleLowerCase('pt-BR')
            .includes(query);
        const days = daysUntil(contract.endDate);
        const matchesFilter =
          filter === 'Todos' ||
          contract.status === filter ||
          (filter === 'Vence em 90 dias' && days >= 0 && days <= 90) ||
          (filter === 'Renovação automática' && contract.automatic);
        return matchesSearch && matchesFilter;
      }),
    [contractItems, filter, search],
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">WEBCO</div>
          <div className="brand-subtitle">Gestão de contratos</div>
        </div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navItems.map(([key, label, Icon]) => {
            const count =
              key === 'contracts'
                ? contractItems.length
                : key === 'calendar'
                  ? 4
                  : key === 'notifications'
                    ? unread
                    : 0;
            return (
              <button
                className={`nav-item${navView === key ? ' active' : ''}`}
                key={key}
                type="button"
                onClick={() => setView(key)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
                {count > 0 ? (
                  <span
                    className={`nav-count${key === 'notifications' ? ' alert' : ''}`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">AM</div>
            <div className="user-copy">
              <strong>Alison Martins</strong>
              <span>alison@webcontinental.com.br</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{pageTitles[view][0]}</span>
            <h1>{pageTitles[view][1]}</h1>
          </div>
          <div className="top-actions">
            <Button
              variant="outline"
              size="icon-lg"
              className="notification-button"
              aria-label="Abrir notificações"
              onClick={() => setView('notifications')}
            >
              <Bell />
              <span>{unread}</span>
            </Button>
            <Button
              size="lg"
              className="primary-action"
              onClick={() => setView('new')}
            >
              <Plus /> Novo contrato
            </Button>
          </div>
        </header>

        <div
          className={`content ${view === 'calendar' ? 'calendar-content' : ''}`}
        >
          {view === 'dashboard' && (
            <Dashboard
              contracts={contractItems}
              openContract={openContract}
              showContracts={() => setView('contracts')}
            />
          )}
          {view === 'contracts' && (
            <ContractsView
              contracts={filteredContracts}
              total={contractItems.length}
              filter={filter}
              search={search}
              onFilter={setFilter}
              onSearch={setSearch}
              onOpen={openContract}
            />
          )}
          {view === 'detail' && (
            <DetailView
              contract={selected}
              tab={detailTab}
              onTab={setDetailTab}
              onBack={() => setView('contracts')}
              onPreview={() => setPreviewOpen(true)}
              onDownload={() =>
                showToast(
                  'Download iniciado',
                  'Contrato principal assinado.pdf · 2,4 MB',
                )
              }
            />
          )}
          {view === 'new' && (
            <NewContract
              autoRenew={autoRenew}
              hasPenalty={hasPenalty}
              onAutoRenew={setAutoRenew}
              onPenalty={setHasPenalty}
              onCancel={() => setView('contracts')}
              onSave={async (formData) => {
                try {
                  const created = await createContract(
                    contractPayload(formData, autoRenew, hasPenalty),
                  );
                  setContractItems((old) => [...old, created]);
                  setView('contracts');
                  showToast(
                    'Contrato salvo',
                    'As regras de notificação já foram aplicadas ao novo contrato.',
                  );
                } catch (error) {
                  showToast(
                    'Não foi possível salvar',
                    error instanceof Error
                      ? error.message
                      : 'Revise os dados e tente novamente.',
                  );
                }
              }}
            />
          )}
          {view === 'notifications' && (
            <NotificationsView
              filter={notificationFilter}
              readIds={readIds}
              onFilter={setNotificationFilter}
              onReadAll={() => setReadIds(notifications.map((item) => item.id))}
              onOpen={(id, contract) => {
                setReadIds((old) => [...new Set([...old, id])]);
                openContract(contract);
              }}
            />
          )}
          {view === 'calendar' && (
            <CalendarView
              contracts={contractItems}
              month={month}
              onMonth={setMonth}
              onOpen={openContract}
            />
          )}
          {view === 'rules' && (
            <RulesView
              rules={rules}
              onToggle={(index, channel) =>
                setRules((old) =>
                  old.map((rule, i) =>
                    i === index ? { ...rule, [channel]: !rule[channel] } : rule,
                  ),
                )
              }
            />
          )}
          {view === 'access' && <AccessView />}
        </div>
      </section>

      <DocumentDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        contract={selected}
        onDownload={() => {
          setPreviewOpen(false);
          showToast(
            'Download iniciado',
            'Contrato principal assinado.pdf · 2,4 MB',
          );
        }}
      />
      {toast ? (
        <output className="toast">
          <strong>{toast.title}</strong>
          <span>{toast.text}</span>
        </output>
      ) : null}
    </main>
  );
}

function Dashboard({
  contracts,
  openContract,
  showContracts,
}: {
  contracts: Contract[];
  openContract: (id: string) => void;
  showContracts: () => void;
}) {
  const metrics = [
    ['Contratos ativos', '9', '8 com renovação automática', ''],
    ['Vencem em 90 dias', '3', '3 exigem decisão neste mês', 'warning'],
    ['Decisão em atraso', '1', 'Aviso prévio expirado', 'danger'],
    ['Custo mensal recorrente', 'R$ 151,7 mil', '+4,2% vs. mês anterior', ''],
  ];
  const actions = [
    [
      'CTR-2025-0088',
      'Hub de integração de marketplaces',
      'Renovação automática em 14 dias — aviso prévio já expirou.',
      'Atrasado',
      'danger',
    ],
    [
      'CTR-2025-0203',
      'Ferramenta de atendimento omnichannel',
      'Fim de vigência em 30/09/2026. Decisão até 01/08/2026.',
      'D-29',
      'warning',
    ],
    [
      'CTR-2026-0142',
      'Plataforma de frete inteligente',
      'Aviso prévio de 60 dias vence hoje — renovação automática ativa.',
      'Hoje',
      'danger',
    ],
    [
      'CTR-2025-0177',
      'Backoffice jurídico — assinatura eletrônica',
      'Reajuste IPCA será aplicado em 01/12/2026.',
      'Reajuste',
      'info',
    ],
    [
      'CTR-2024-0311',
      'Licenças de ERP — módulo fiscal',
      'Sem renovação automática. Decisão até 02/10/2026.',
      'D-31',
      'warning',
    ],
  ] as const;
  const destinationCounts = Object.entries(
    contracts.reduce<Record<string, number>>(
      (acc, item) => ({
        ...acc,
        [item.destination]: (acc[item.destination] ?? 0) + 1,
      }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...destinationCounts.map(([, value]) => value));
  const upcoming = contracts
    .filter(
      (item) => daysUntil(item.endDate) >= 0 && daysUntil(item.endDate) <= 180,
    )
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  return (
    <>
      <section className="metrics" aria-label="Indicadores principais">
        {metrics.map(([label, value, hint, tone]) => (
          <article className="metric-card" key={label}>
            <span className="eyebrow">{label}</span>
            <strong className={tone ? `text-${tone}` : ''}>{value}</strong>
            <span>{hint}</span>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="card actions-card">
          <div className="card-heading">
            <div>
              <h2>Ações necessárias</h2>
              <p>Contratos com prazo de decisão em aberto</p>
            </div>
            <Button variant="outline" size="sm" onClick={showContracts}>
              Ver todos
            </Button>
          </div>
          <div>
            {actions.map(([id, name, message, status, tone]) => (
              <button
                className="action-row"
                key={id}
                type="button"
                onClick={() => openContract(id)}
              >
                <span className={`status-dot ${tone}`} />
                <span className="action-copy">
                  <strong>{name}</strong>
                  <span>{message}</span>
                </span>
                <Pill tone={tone}>{status}</Pill>
                <ChevronRight className="row-chevron" />
              </button>
            ))}
          </div>
        </section>
        <div className="side-cards">
          <section className="card compact-card">
            <div className="card-heading simple">
              <h2>Contratos por destinação</h2>
            </div>
            <div className="bar-list">
              {destinationCounts.map(([label, count], i) => (
                <div className="bar-item" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${(count / max) * 100}%`,
                        background: `var(--chart-${(i % 4) + 1})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="card compact-card">
            <div className="card-heading simple">
              <div>
                <h2>Próximos vencimentos</h2>
                <p>Fim de vigência nos próximos 180 dias</p>
              </div>
            </div>
            <div className="deadline-list">
              {upcoming.map((item) => {
                const days = daysUntil(item.endDate);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => openContract(item.id)}
                  >
                    <span className="deadline-date">
                      {item.end.slice(0, 5)}
                    </span>
                    <span className="deadline-name">{item.name}</span>
                    <Pill
                      tone={
                        days <= 30
                          ? 'danger'
                          : days <= 90
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      D-{days}
                    </Pill>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ContractsView({
  contracts: items,
  total,
  filter,
  search,
  onFilter,
  onSearch,
  onOpen,
}: {
  contracts: Contract[];
  total: number;
  filter: string;
  search: string;
  onFilter: (value: string) => void;
  onSearch: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const filters = [
    'Todos',
    'Vigente',
    'Em renovação',
    'Vence em 90 dias',
    'Renovação automática',
    'Encerrado',
  ];
  return (
    <section className="list-page">
      <div className="filter-bar">
        <div className="search-box">
          <Search aria-hidden="true" />
          <Input
            aria-label="Buscar contratos"
            placeholder="Buscar por contrato, fornecedor ou nº"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        <div className="filter-chips">
          {filters.map((item) => (
            <button
              type="button"
              className={filter === item ? 'active' : ''}
              key={item}
              onClick={() => onFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="result-count">
          {items.length} de {total} contratos
        </span>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {[
                'Contrato',
                'Destinado a',
                'Vigência',
                'Renovação',
                'Aviso prévio',
                'Multa',
                'Cobrança',
                'Valor',
                'Status',
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => onOpen(item.id)}>
                <td>
                  <strong>{item.name}</strong>
                  <span>
                    <code>{item.id}</code> · {item.vendor}
                  </span>
                </td>
                <td>
                  <Pill>{item.destination}</Pill>
                </td>
                <td>
                  <code>
                    {item.start.slice(3)} → {item.end}
                  </code>
                </td>
                <td className={item.automatic ? 'positive' : ''}>
                  {item.automatic ? 'Automática' : 'Manual'}
                </td>
                <td>{item.notice} dias</td>
                <td>{item.penalty ? 'Sim' : 'Não'}</td>
                <td>{item.billing}</td>
                <td className="money">
                  <code>{money(item.value)}</code>
                </td>
                <td>
                  <Pill tone={toneForStatus(item.status)}>{item.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum contrato encontrado</strong>
            <span>Ajuste os filtros ou cadastre um novo contrato.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DetailView({
  contract,
  tab,
  onTab,
  onBack,
  onPreview,
  onDownload,
}: {
  contract: Contract;
  tab: 'summary' | 'documents' | 'history';
  onTab: (tab: 'summary' | 'documents' | 'history') => void;
  onBack: () => void;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const deadline = decisionDate(contract);
  const decisionDays = Math.round(
    (deadline.getTime() - TODAY.getTime()) / 86400000,
  );
  const blocks = [
    [
      'Vigência e renovação',
      [
        ['Vigência', `${contract.start} a ${contract.end}`],
        ['Dias restantes', `${daysUntil(contract.endDate)} dias`],
        [
          'Renovação automática',
          contract.automatic
            ? 'Sim — renova por 12 meses'
            : 'Não — exige novo aditivo',
        ],
        ['Aviso prévio mínimo', `${contract.notice} dias corridos`],
        ['Data-limite de decisão', formatDate(deadline)],
        [
          'Multa por cancelamento',
          contract.penalty ? `Sim — ${contract.penaltyBase}` : 'Não prevista',
        ],
      ],
    ],
    [
      'Financeiro',
      [
        ['Formato de cobrança', contract.billing],
        [
          'Valor',
          `${money(contract.value)}${contract.billing === 'Mensal' ? ' / mês' : ''}`,
        ],
        ['Índice de reajuste', contract.adjustment],
        ['Centro de custo', contract.costCenter],
        ['Squad responsável', contract.squad],
        ['Gestor interno', contract.manager],
      ],
    ],
    [
      'Escopo e operação',
      [
        ['Destinado a', contract.destination],
        ['Sistemas integrados', contract.systems],
        ['Criticidade', contract.criticality],
        ['SLA contratado', contract.sla],
      ],
    ],
    [
      'Conformidade',
      [
        ['Confidencialidade / LGPD', contract.lgpd],
        ['Contrato assinado', 'Sim — assinatura eletrônica'],
        ['Aditivos vigentes', '2 aditivos'],
        ['Última revisão jurídica', '12/03/2026 · Patrícia Nunes'],
      ],
    ],
  ] as const;
  const docs = [
    [
      'PDF',
      'Contrato principal assinado.pdf',
      '2,4 MB · enviado em 01/11/2024 por Patrícia Nunes',
      'Contrato',
    ],
    [
      'PDF',
      'Aditivo 01 — reajuste IPCA.pdf',
      '480 KB · enviado em 12/11/2025 por Rafael Coutinho',
      'Aditivo',
    ],
    [
      'PDF',
      'Aditivo 02 — ampliação de escopo 3P.pdf',
      '610 KB · enviado em 03/03/2026 por Rafael Coutinho',
      'Aditivo',
    ],
    [
      'DOCX',
      'Proposta comercial original.docx',
      '220 KB · enviado em 18/10/2024 por Juliana Prado',
      'Anexo',
    ],
  ] as const;
  const history = [
    [
      'Notificação enviada — D-60',
      'E-mail e alerta em tela para gestor e jurídico.',
      '01/09/2026 08:00 · Sistema',
      'info',
    ],
    [
      'Aditivo 02 registrado',
      'Ampliação de escopo para operação 3P.',
      '03/03/2026 14:22 · Rafael Coutinho',
      'success',
    ],
    [
      'Valor reajustado',
      'R$ 17.650,00 → R$ 18.400,00 (IPCA 4,25%).',
      '12/11/2025 09:10 · Sistema',
      'warning',
    ],
    [
      'Prazo de aviso alterado',
      'De 30 para 60 dias corridos.',
      '12/11/2025 09:05 · Patrícia Nunes',
      'neutral',
    ],
    [
      'Contrato cadastrado',
      'Importado da base jurídica.',
      '01/11/2024 16:40 · Juliana Prado',
      'primary',
    ],
  ] as const;
  return (
    <section className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ChevronLeft /> Voltar para contratos
      </button>
      {decisionDays <= 30 ? (
        <div
          className={`deadline-alert ${decisionDays < 0 ? 'danger' : 'warning'}`}
        >
          <AlertTriangle />
          <div>
            <strong>
              {decisionDays < 0
                ? 'Prazo de aviso prévio expirado'
                : 'Decisão de renovação necessária'}
            </strong>
            <span>
              {decisionDays < 0
                ? `O aviso prévio venceu em ${formatDate(deadline)}. A renovação automática ocorrerá em ${contract.end}.`
                : `Para cancelar sem multa, comunique o fornecedor até ${formatDate(deadline)} (${decisionDays} dias).`}
            </span>
          </div>
        </div>
      ) : null}
      <div className="contract-heading card">
        <div className="contract-identity">
          <div>
            <h2>{contract.name}</h2>
            <Pill tone={toneForStatus(contract.status)}>{contract.status}</Pill>
            <Pill tone={toneForCriticality(contract.criticality)}>
              Criticidade {contract.criticality.toLowerCase()}
            </Pill>
          </div>
          <p>
            <code>{contract.id}</code> · {contract.vendor} · CNPJ{' '}
            {contract.cnpj}
          </p>
        </div>
        <div className="contract-actions">
          <Button variant="outline" onClick={onPreview}>
            <Eye /> Visualizar contrato
          </Button>
          <Button variant="outline" onClick={onDownload}>
            <Download /> Baixar
          </Button>
          <Button variant="outline">Registrar renovação</Button>
          <Button variant="destructive">Cancelar contrato</Button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {(
          [
            ['summary', 'Resumo'],
            ['documents', 'Documentos'],
            ['history', 'Histórico'],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            key={key}
            onClick={() => onTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'summary' ? (
        <div className="summary-grid">
          {blocks.map(([title, items]) => (
            <section className="info-card card" key={title}>
              <h3>{title}</h3>
              <dl>
                {items.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : null}
      {tab === 'documents' ? (
        <section className="card document-card">
          <div className="card-heading">
            <h2>Documentos anexos</h2>
            <Button variant="outline">
              <Upload /> Enviar arquivo
            </Button>
          </div>
          {docs.map(([ext, name, meta, type]) => (
            <div className="document-row" key={name}>
              <span className="file-chip">{ext}</span>
              <span className="document-copy">
                <strong>{name}</strong>
                <span>{meta}</span>
              </span>
              <Pill>{type}</Pill>
              <Button variant="outline" size="sm" onClick={onPreview}>
                Visualizar
              </Button>
              <Button variant="ghost" size="sm" onClick={onDownload}>
                Baixar
              </Button>
            </div>
          ))}
        </section>
      ) : null}
      {tab === 'history' ? (
        <section className="card history-card">
          {history.map(([action, detail, when, tone], index) => (
            <div className="history-item" key={action}>
              <div className="history-track">
                <span className={tone} />
                {index < history.length - 1 ? <i /> : null}
              </div>
              <div>
                <strong>{action}</strong>
                <p>{detail}</p>
                <code>{when}</code>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function Field({
  label,
  span,
  children,
  hint,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className={`form-field${span ? ' span' : ''}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function NewContract({
  autoRenew,
  hasPenalty,
  onAutoRenew,
  onPenalty,
  onCancel,
  onSave,
}: {
  autoRenew: boolean;
  hasPenalty: boolean;
  onAutoRenew: (value: boolean) => void;
  onPenalty: (value: boolean) => void;
  onCancel: () => void;
  onSave: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      className="contract-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave(new FormData(event.currentTarget));
      }}
    >
      <FormSection title="Identificação">
        <Field
          label="Nome do contrato"
          span
          hint="Aparece nas listagens e notificações."
        >
          <input
            name="name"
            required
            placeholder="Ex.: Plataforma de logística"
          />
        </Field>
        <Field label="Fornecedor">
          <input name="vendor" required placeholder="Razão social" />
        </Field>
        <Field label="CNPJ">
          <input
            name="cnpj"
            required
            className="mono"
            placeholder="00.000.000/0000-00"
          />
        </Field>
        <Field label="Destinado a">
          <select name="destination" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {[
              '1P',
              '3P',
              '1P e 3P',
              'TI',
              'Logística',
              'Jurídico',
              'Corporativo',
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Criticidade">
          <select name="criticality">
            <option>Alta</option>
            <option>Média</option>
            <option>Baixa</option>
          </select>
        </Field>
      </FormSection>
      <FormSection title="Vigência e renovação">
        <Field label="Início da vigência">
          <input name="start" required type="date" />
        </Field>
        <Field label="Fim da vigência">
          <input name="end" required type="date" />
        </Field>
        <SwitchBlock
          title="Contrato possui renovação automática?"
          text="Se ativo, o sistema dispara alertas antes da data-limite de decisão."
          checked={autoRenew}
          onChange={onAutoRenew}
        />
        {autoRenew ? (
          <Field label="Renova por">
            <select name="renewalPeriodMonths">
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
              <option value="6">6 meses</option>
            </select>
          </Field>
        ) : null}
        <Field
          label="Período mínimo de aviso"
          hint="A data-limite de decisão é calculada automaticamente."
        >
          <div className="compound-input">
            <input
              name="notice"
              required
              min="1"
              type="number"
              defaultValue="60"
            />
            <select name="noticeUnit">
              <option value="calendar_days">dias corridos</option>
              <option value="business_days">dias úteis</option>
              <option value="months">meses</option>
            </select>
          </div>
        </Field>
        <SwitchBlock
          title="Exige multa por cancelamento antecipado?"
          text="Informe a base de cálculo prevista em cláusula."
          checked={hasPenalty}
          onChange={onPenalty}
        />
        {hasPenalty ? (
          <Field label="Base da multa" span>
            <input
              name="penaltyBase"
              required
              placeholder="Ex.: 30% do valor remanescente"
            />
          </Field>
        ) : null}
      </FormSection>
      <FormSection title="Financeiro" three>
        <Field label="Formato de cobrança">
          <select name="billing">
            <option>Mensal</option>
            <option>Trimestral</option>
            <option>Anual</option>
            <option>Por uso / variável</option>
          </select>
        </Field>
        <Field label="Valor">
          <input name="value" required className="mono" placeholder="R$ 0,00" />
        </Field>
        <Field label="Índice de reajuste">
          <select name="adjustment">
            <option>IPCA</option>
            <option>IGP-M</option>
            <option>INPC</option>
            <option>Sem reajuste</option>
          </select>
        </Field>
        <Field label="Centro de custo">
          <input
            name="costCenter"
            required
            pattern="CC-[0-9]{4}"
            placeholder="CC-0000"
          />
        </Field>
        <Field label="Squad responsável">
          <input name="squad" required />
        </Field>
        <Field label="Gestor interno">
          <input name="manager" required />
        </Field>
      </FormSection>
      <FormSection title="Operação e conformidade">
        <Field label="SLA contratado">
          <input name="sla" placeholder="Ex.: 99,5% de disponibilidade" />
        </Field>
        <Field label="Sistemas integrados">
          <input name="systems" placeholder="OMS, ERP, CRM..." />
        </Field>
        <Field label="Observações de confidencialidade / LGPD" span>
          <textarea name="lgpd" rows={4} />
        </Field>
      </FormSection>
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar contrato</Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
  three,
}: {
  title: string;
  children: React.ReactNode;
  three?: boolean;
}) {
  return (
    <section className="card form-section">
      <h2>{title}</h2>
      <div className={`form-grid${three ? ' three' : ''}`}>{children}</div>
    </section>
  );
}
function SwitchBlock({
  title,
  text,
  checked,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="switch-block">
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="large-switch"
      />
    </div>
  );
}

function NotificationsView({
  filter,
  readIds,
  onFilter,
  onReadAll,
  onOpen,
}: {
  filter: 'Não lidas' | 'Todas';
  readIds: string[];
  onFilter: (value: 'Não lidas' | 'Todas') => void;
  onReadAll: () => void;
  onOpen: (id: string, contract: string) => void;
}) {
  const items = notifications.filter(
    (item) => filter === 'Todas' || !readIds.includes(item.id),
  );
  return (
    <section className="notifications-page">
      <div className="notification-controls">
        <div className="filter-chips">
          {(['Não lidas', 'Todas'] as const).map((item) => (
            <button
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => onFilter(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <button type="button" className="text-button" onClick={onReadAll}>
          Marcar todas como lidas
        </button>
      </div>
      <div className="card notification-list">
        {items.map((item) => {
          const read = readIds.includes(item.id);
          return (
            <button
              className={`notification-row${read ? ' read' : ''}`}
              type="button"
              key={item.id}
              onClick={() => onOpen(item.id, item.contract)}
            >
              <span className={`notification-code ${item.tone}`}>
                {item.code}
              </span>
              <span className="notification-copy">
                <span>
                  <strong>{item.title}</strong>
                  <Pill tone={item.tone}>{item.tag}</Pill>
                </span>
                <p>{item.text}</p>
                <code>
                  {item.when} · {item.channels}
                </code>
              </span>
              <i className={read ? 'read' : ''} />
            </button>
          );
        })}
        {items.length === 0 ? (
          <div className="empty-state">
            <strong>Tudo em dia</strong>
            <span>Não há notificações não lidas.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CalendarView({
  contracts,
  month,
  onMonth,
  onOpen,
}: {
  contracts: Contract[];
  month: number;
  onMonth: (value: number) => void;
  onOpen: (id: string) => void;
}) {
  const names = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const offset = new Date(2026, month, 1).getDay();
  const total = new Date(2026, month + 1, 0).getDate();
  const cells = Array.from({ length: offset + total }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  return (
    <section className="calendar-page">
      <div className="calendar-toolbar">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Mês anterior"
          onClick={() => onMonth(Math.max(0, month - 1))}
        >
          <ChevronLeft />
        </Button>
        <strong>{names[month]} de 2026</strong>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Próximo mês"
          onClick={() => onMonth(Math.min(11, month + 1))}
        >
          <ChevronRight />
        </Button>
        <div className="calendar-legend">
          <span>
            <i className="danger" />
            Fim de vigência
          </span>
          <span>
            <i className="warning" />
            Data-limite de aviso prévio
          </span>
          <span>
            <i className="primary" />
            Hoje
          </span>
        </div>
      </div>
      <div className="calendar-card card">
        <div className="weekday-row">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            const date = day ? new Date(2026, month, day) : null;
            const today = date?.toDateString() === TODAY.toDateString();
            const events = day
              ? contracts.flatMap((contract) => {
                  const end = new Date(`${contract.endDate}T12:00:00`);
                  const decision = decisionDate(contract);
                  const list: { label: string; tone: Tone; id: string }[] = [];
                  if (
                    end.getFullYear() === 2026 &&
                    end.getMonth() === month &&
                    end.getDate() === day
                  )
                    list.push({
                      label: `Fim · ${contract.name}`,
                      tone: 'danger',
                      id: contract.id,
                    });
                  if (
                    decision.getFullYear() === 2026 &&
                    decision.getMonth() === month &&
                    decision.getDate() === day
                  )
                    list.push({
                      label: `Aviso prévio · ${contract.vendor}`,
                      tone: 'warning',
                      id: contract.id,
                    });
                  return list;
                })
              : [];
            return (
              <div
                className={`calendar-cell${!day ? ' blank' : ''}${today ? ' today' : ''}`}
                key={index}
              >
                <span>{day}</span>
                {events.map((event) => (
                  <button
                    type="button"
                    className={event.tone}
                    key={event.label}
                    onClick={() => onOpen(event.id)}
                  >
                    {event.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RulesView({
  rules,
  onToggle,
}: {
  rules: {
    title: string;
    description: string;
    recipients: string;
    screen: boolean;
    email: boolean;
  }[];
  onToggle: (index: number, channel: 'screen' | 'email') => void;
}) {
  return (
    <section className="rules-page">
      <div className="info-alert">
        <Info />
        <span>
          As regras valem para todos os contratos. Cada contrato pode
          sobrescrever prazos no próprio cadastro.
        </span>
      </div>
      <div className="card rules-card">
        <div className="rules-header">
          <span>Gatilho</span>
          <span>Em tela</span>
          <span>E-mail</span>
          <span>Destinatários</span>
        </div>
        {rules.map((rule, index) => (
          <div className="rule-row" key={rule.title}>
            <div>
              <strong>{rule.title}</strong>
              <span>{rule.description}</span>
            </div>
            <Switch
              checked={rule.screen}
              onCheckedChange={() => onToggle(index, 'screen')}
              aria-label={`Notificação em tela: ${rule.title}`}
            />
            <Switch
              checked={rule.email}
              onCheckedChange={() => onToggle(index, 'email')}
              aria-label={`E-mail: ${rule.title}`}
            />
            <span>{rule.recipients}</span>
          </div>
        ))}
      </div>
      <section className="card email-preview">
        <h2>Pré-visualização do e-mail</h2>
        <p>Modelo enviado no gatilho D-60</p>
        <div>
          <header>
            <b>Assunto:</b> [Contratos] Faltam 60 dias para o fim da vigência —
            Plataforma de frete inteligente
            <br />
            <b>Para:</b> gestor.contrato@webcontinental.com.br ·
            juridico@webcontinental.com.br
          </header>
          <article>
            <h3>Decisão de renovação necessária</h3>
            <p>
              O contrato <code>CTR-2026-0142</code> chega ao fim em{' '}
              <strong>31/10/2026</strong>. Revise as condições e registre a
              decisão dentro do prazo.
            </p>
            <Button>Abrir contrato</Button>
            <Button variant="outline">Registrar decisão</Button>
          </article>
        </div>
      </section>
    </section>
  );
}

function AccessView() {
  const colors = [
    '#0b286e',
    '#1753cc',
    '#ff8604',
    '#0098ff',
    '#6a7fb5',
    '#001338',
  ];
  return (
    <section className="access-page">
      <section className="card users-card">
        <div className="card-heading">
          <h2>Usuários</h2>
          <Button aria-label="Convidar novo usuário">
            <Plus /> Convidar usuário
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'Usuário',
                  'Área',
                  'Contratos sob gestão',
                  'Último acesso',
                  'Situação',
                ].map((item) => (
                  <th key={item}>{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(
                ([name, email, initials, area, count, last, status], index) => (
                  <tr key={email}>
                    <td aria-label={`Usuário: ${name}`}>
                      <div className="person">
                        <span style={{ background: colors[index] }}>
                          {initials}
                        </span>
                        <div>
                          <strong>{name}</strong>
                          <small>{email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{area}</td>
                    <td>{count}</td>
                    <td>
                      <code>{last}</code>
                    </td>
                    <td>
                      <Pill tone={status === 'Ativo' ? 'success' : 'warning'}>
                        {status}
                      </Pill>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card access-note">
        <Info aria-hidden="true" />
        <div>
          <h2>Acesso único para todos os usuários</h2>
          <p>
            Todo usuário convidado pode consultar, cadastrar, editar, anexar
            documentos e registrar decisões. O controle é feito por convite e
            desativação, mantendo o rastro de cada ação no histórico.
          </p>
        </div>
      </section>
    </section>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  contract,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  onDownload: () => void;
}) {
  const deadline = formatDate(decisionDate(contract));
  const clauses = [
    [
      'Cláusula 1ª — Objeto',
      `Prestação de serviços de ${contract.name.toLowerCase()} pela CONTRATADA ${contract.vendor}, inscrita no CNPJ sob o nº ${contract.cnpj}, destinada à operação ${contract.destination} da CONTRATANTE.`,
    ],
    [
      'Cláusula 2ª — Vigência',
      `O presente contrato vigora de ${contract.start} a ${contract.end}. ${contract.automatic ? 'Findo o prazo, renova-se automaticamente por períodos sucessivos de 12 meses.' : 'A continuidade depende de novo aditivo firmado entre as partes.'}`,
    ],
    [
      'Cláusula 3ª — Denúncia e aviso prévio',
      `Qualquer das partes poderá denunciar o contrato com antecedência mínima de ${contract.notice} dias corridos, fixando a data-limite de decisão em ${deadline}.`,
    ],
    [
      'Cláusula 4ª — Preço e reajuste',
      `A CONTRATANTE pagará ${money(contract.value)} em regime de cobrança ${contract.billing.toLowerCase()}, reajustado anualmente pela variação do ${contract.adjustment}.`,
    ],
    [
      'Cláusula 5ª — Multa por rescisão antecipada',
      contract.penalty
        ? `A rescisão antecipada sujeita a parte denunciante à multa de ${contract.penaltyBase}.`
        : 'Não há previsão de multa por rescisão antecipada.',
    ],
    [
      'Cláusula 6ª — Nível de serviço',
      `A CONTRATADA obriga-se a manter ${contract.sla}, apurado mensalmente.`,
    ],
    [
      'Cláusula 7ª — Confidencialidade e proteção de dados',
      `${contract.lgpd}. As partes observarão a Lei nº 13.709/2018 (LGPD).`,
    ],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="document-dialog" showCloseButton>
        <DialogHeader className="document-dialog-header">
          <span className="file-chip">PDF</span>
          <div>
            <DialogTitle>Contrato principal assinado.pdf</DialogTitle>
            <DialogDescription>2,4 MB · {contract.vendor}</DialogDescription>
          </div>
          <Button onClick={onDownload}>
            <Download /> Baixar PDF
          </Button>
        </DialogHeader>
        <div className="document-stage">
          <article className="paper">
            <span className="eyebrow">Webcontinental · {contract.id}</span>
            <h2>
              Instrumento particular de prestação de serviços — {contract.name}
            </h2>
            <hr />
            {clauses.map(([title, text]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </section>
            ))}
            <div className="signatures">
              <span>WEBCONTINENTAL LTDA.</span>
              <span>{contract.vendor.toUpperCase()}</span>
            </div>
            <code>
              {contract.id} · assinado eletronicamente · hash 4f2a·9c11·be07
            </code>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
