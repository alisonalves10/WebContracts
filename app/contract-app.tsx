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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
} from './data';
import {
  cancelContract,
  ContractHistoryEntry,
  contractPayload,
  createContract,
  fetchContractHistory,
  fetchContracts,
  fetchUsers,
  inviteUser,
  renewContract,
  updateContract,
  UserRecord,
} from './api';

type View =
  | 'dashboard'
  | 'contracts'
  | 'detail'
  | 'new'
  | 'edit'
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
  edit: ['Contratos', 'Editar contrato'],
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

const VERTICAL_OPTIONS = [
  '1P',
  '3P',
  '1P e 3P',
  'Controladoria',
  'Gallant Câmeras Frias',
  'Gallant Importação',
  'Peças',
  'TI',
  'WebCo',
] as const;

const SECTOR_OPTIONS = [
  'Atendiamento Especiais',
  'Auditoria',
  'Compliance',
  'Comercial Canais 3P',
  'Comercial Sellers 3P',
  'Comercial Hub 1P',
  'Dpto de Vendas',
  'Compras',
  'Contabilidade',
  'Controladoria',
  'E-commerce Webco',
  'Contas a Pagar',
  'Contas a Receber',
  'Fiscal',
  'B2B',
  'Importação',
  'Gallant Refrigeração',
  'Jurídico Tributário',
  'Logística',
  'Marketing',
  'Onboarding 3P',
  'Produto 1P',
  'Produto 3P',
  'Qualidade 3P',
  'Qualidade 1P',
  'Sac 3P',
  'Sac 1P',
  'TI',
  'Indústria',
  'Webinstala',
  'Webresolve',
] as const;

const ruleSeed = [
  [
    'D-90 / D-60 / D-30 do fim da vigência',
    'Alerta escalonado conforme a data de término.',
    true,
    true,
  ],
  [
    'Prazo de aviso prévio se aproximando',
    'Dispara 15 dias antes da data-limite de decisão.',
    true,
    true,
  ],
  [
    'Renovação automática prestes a ocorrer',
    'Avisa 7 dias antes da renovação tácita.',
    true,
    true,
  ],
  [
    'Reajuste anual aplicado',
    'Na data de aniversário, com o índice do contrato.',
    true,
    false,
  ],
  [
    'Documento obrigatório ausente',
    'Contrato sem PDF assinado após 5 dias do cadastro.',
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

function ApplicationsIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function toneForStatus(status: Contract['status']): Tone {
  return status === 'Vigente'
    ? 'success'
    : status === 'Em renovação'
      ? 'warning'
      : status === 'Cancelado'
        ? 'danger'
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
  const [search, setSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<
    'Não lidas' | 'Todas'
  >('Não lidas');
  const [calendarCursor, setCalendarCursor] = useState({
    month: 8,
    year: 2026,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [autoRenew, setAutoRenew] = useState(true);
  const [hasPenalty, setHasPenalty] = useState(false);
  const [history, setHistory] = useState<ContractHistoryEntry[]>([]);
  const [userItems, setUserItems] = useState<UserRecord[]>([]);
  const [rules, setRules] = useState(
    ruleSeed.map(([title, description, screen, email]) => ({
      title,
      description,
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

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal)
      .then(setUserItems)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (view !== 'detail') return;
    fetchContractHistory(selectedId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [selectedId, view]);

  const selected =
    contractItems.find((contract) => contract.id === selectedId) ??
    contractItems[0] ??
    seedContracts[0];
  const unread = notifications.length - readIds.length;
  const navView =
    view === 'detail' || view === 'new' || view === 'edit' ? 'contracts' : view;
  const openContract = (id: string) => {
    setSelectedId(id);
    setDetailTab('summary');
    setView('detail');
  };
  const showToast = (title: string, text: string) => {
    setToast({ title, text });
    window.setTimeout(() => setToast(null), 3600);
  };
  const replaceContract = (contract: Contract) => {
    setContractItems((items) =>
      items.map((item) => (item.id === contract.id ? contract : item)),
    );
  };
  const refreshHistory = async (id: string) => {
    setHistory(await fetchContractHistory(id));
  };
  const openEditContract = () => {
    setAutoRenew(selected.automatic);
    setHasPenalty(selected.penalty);
    setView('edit');
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
        return matchesSearch;
      }),
    [contractItems, search],
  );
  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLocaleLowerCase('pt-BR');

    return contractItems
      .filter(
        (contract) =>
          !query ||
          `${contract.name} ${contract.vendor} ${contract.id}`
            .toLocaleLowerCase('pt-BR')
            .includes(query),
      )
      .slice(0, 8);
  }, [contractItems, globalSearch]);

  const selectGlobalSearchResult = (id: string) => {
    setGlobalSearchOpen(false);
    setGlobalSearch('');
    openContract(id);
  };

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
              className="header-search-button"
              aria-label="Pesquisar contratos"
              onClick={() => setGlobalSearchOpen(true)}
            >
              <Search />
              <span>Buscar contratos...</span>
            </Button>
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
            <Popover open={solutionOpen} onOpenChange={setSolutionOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="solution-button"
                    aria-label="Aplicativos Webcontinental"
                  >
                    <ApplicationsIcon />
                  </Button>
                }
              />
              <PopoverContent
                className="solution-popover"
                align="end"
                sideOffset={8}
              >
                <span className="solution-popover-title">
                  Ecossistema Webcontinental
                </span>
                <div className="solution-grid">
                  {[
                    ['WS', 'Web Strategy', 'orange'],
                    ['WC', 'Web Control', 'sky'],
                    ['WM', 'Web Maps', 'blue'],
                    ['WP', 'Web Projects', 'navy'],
                    ['WT', 'WebContracts', 'contracts'],
                  ].map(([initials, name, tone]) => (
                    <button
                      type="button"
                      key={name}
                      className={name === 'WebContracts' ? 'active' : ''}
                      onClick={() => {
                        setSolutionOpen(false);
                        if (name !== 'WebContracts')
                          showToast(
                            'Aplicativo indisponível',
                            `${name} estará disponível em breve.`,
                          );
                      }}
                    >
                      <span className={`solution-mark ${tone}`}>
                        {initials}
                        {name === 'Web Projects' ? <i /> : null}
                      </span>
                      <small>{name}</small>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="all-solutions-link"
                  onClick={() => {
                    setSolutionOpen(false);
                    showToast(
                      'Ecossistema Webcontinental',
                      'Todos os aplicativos disponíveis estão listados acima.',
                    );
                  }}
                >
                  Ver todas as soluções
                </button>
              </PopoverContent>
            </Popover>
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
              search={search}
              onSearch={setSearch}
              onOpen={openContract}
              onNew={() => {
                setAutoRenew(true);
                setHasPenalty(false);
                setView('new');
              }}
            />
          )}
          {view === 'detail' && (
            <DetailView
              contract={selected}
              history={history}
              tab={detailTab}
              onTab={setDetailTab}
              onBack={() => setView('contracts')}
              onPreview={() => setPreviewOpen(true)}
              onEdit={openEditContract}
              onCancelContract={async () => {
                if (
                  !window.confirm(
                    `Confirma o cancelamento do contrato ${selected.id}?`,
                  )
                )
                  return;
                try {
                  const updated = await cancelContract(selected.id);
                  replaceContract(updated);
                  await refreshHistory(updated.id);
                  setDetailTab('history');
                  showToast(
                    'Contrato cancelado',
                    'A ação e o usuário foram registrados no histórico.',
                  );
                } catch (error) {
                  showToast(
                    'Não foi possível cancelar',
                    error instanceof Error ? error.message : 'Tente novamente.',
                  );
                }
              }}
              onRenewContract={async () => {
                if (
                  !window.confirm(
                    `Registrar a renovação do contrato ${selected.id}?`,
                  )
                )
                  return;
                try {
                  const updated = await renewContract(selected.id);
                  replaceContract(updated);
                  await refreshHistory(updated.id);
                  setDetailTab('history');
                  showToast(
                    'Renovação registrada',
                    `A nova vigência termina em ${updated.end}.`,
                  );
                } catch (error) {
                  showToast(
                    'Não foi possível renovar',
                    error instanceof Error ? error.message : 'Tente novamente.',
                  );
                }
              }}
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
          {view === 'edit' && (
            <NewContract
              initial={selected}
              autoRenew={autoRenew}
              hasPenalty={hasPenalty}
              onAutoRenew={setAutoRenew}
              onPenalty={setHasPenalty}
              onCancel={() => setView('detail')}
              onSave={async (formData) => {
                try {
                  const updated = await updateContract(
                    selected.id,
                    contractPayload(
                      formData,
                      autoRenew,
                      hasPenalty,
                      selected.id,
                    ),
                  );
                  replaceContract(updated);
                  await refreshHistory(updated.id);
                  setView('detail');
                  showToast(
                    'Contrato atualizado',
                    'As alterações e o usuário foram registrados no histórico.',
                  );
                } catch (error) {
                  showToast(
                    'Não foi possível atualizar',
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
              month={calendarCursor.month}
              year={calendarCursor.year}
              onNavigate={(direction) =>
                setCalendarCursor((current) => {
                  const date = new Date(
                    current.year,
                    current.month + direction,
                    1,
                  );
                  return { month: date.getMonth(), year: date.getFullYear() };
                })
              }
              onSelectDate={(month, year) => setCalendarCursor({ month, year })}
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
          {view === 'access' && (
            <AccessView
              users={userItems}
              onInvite={async (input) => {
                const invited = await inviteUser(input);
                setUserItems((items) => [...items, invited]);
                showToast(
                  'Convite enviado',
                  `${invited.name} foi adicionado com acesso pendente.`,
                );
              }}
            />
          )}
        </div>
      </section>

      <GlobalSearchDialog
        open={globalSearchOpen}
        query={globalSearch}
        results={globalSearchResults}
        onQueryChange={setGlobalSearch}
        onOpenChange={(open) => {
          setGlobalSearchOpen(open);
          if (!open) setGlobalSearch('');
        }}
        onSelect={selectGlobalSearchResult}
      />
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

function GlobalSearchDialog({
  open,
  query,
  results,
  onQueryChange,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  query: string;
  results: Contract[];
  onQueryChange: (query: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="global-search-dialog" showCloseButton={false}>
        <DialogHeader className="global-search-header">
          <DialogTitle>Pesquisar contratos</DialogTitle>
          <DialogDescription>
            Encontre por contrato, fornecedor ou código.
          </DialogDescription>
        </DialogHeader>
        <div className="global-search-field">
          <Search aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Digite para pesquisar..."
            aria-label="Pesquisar contrato, fornecedor ou código"
          />
        </div>
        <div className="global-search-results" aria-live="polite">
          {results.length ? (
            results.map((contract) => (
              <button
                type="button"
                className="global-search-result"
                key={contract.id}
                onClick={() => onSelect(contract.id)}
              >
                <span className="global-search-result-copy">
                  <strong>{contract.name}</strong>
                  <span>
                    {contract.id} · {contract.vendor}
                  </span>
                </span>
                <Pill tone={toneForStatus(contract.status)}>
                  {contract.status}
                </Pill>
              </button>
            ))
          ) : (
            <div className="global-search-empty">
              <Search aria-hidden="true" />
              <strong>Nenhum contrato encontrado</strong>
              <span>Tente pesquisar com outro nome, fornecedor ou código.</span>
            </div>
          )}
        </div>
        <div className="global-search-footer">
          {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
        </div>
      </DialogContent>
    </Dialog>
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
              <h2>Contratos por vertical</h2>
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
  search,
  onSearch,
  onOpen,
  onNew,
}: {
  contracts: Contract[];
  total: number;
  search: string;
  onSearch: (value: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [expiryFilters, setExpiryFilters] = useState<number[]>([]);
  const [verticalFilters, setVerticalFilters] = useState<string[]>([]);
  const [sectorFilters, setSectorFilters] = useState<string[]>([]);
  const statuses = ['Vigente', 'Em renovação', 'Encerrado', 'Cancelado'];
  const filteredItems = items.filter((contract) => {
    const days = daysUntil(contract.endDate);
    return (
      (!statusFilters.length || statusFilters.includes(contract.status)) &&
      (!expiryFilters.length ||
        expiryFilters.some((limit) => days >= 0 && days <= limit)) &&
      (!verticalFilters.length ||
        verticalFilters.includes(contract.destination)) &&
      (!sectorFilters.length || sectorFilters.includes(contract.squad))
    );
  });
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const firstResult = filteredItems.length
    ? (currentPage - 1) * pageSize + 1
    : 0;
  const lastResult = Math.min(currentPage * pageSize, filteredItems.length);
  const toggleFilter = <T extends string | number>(
    value: T,
    values: T[],
    setValues: React.Dispatch<React.SetStateAction<T[]>>,
  ) => {
    setPage(1);
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  return (
    <section className="list-page">
      <div className="filter-bar">
        <div className="search-box">
          <Search aria-hidden="true" />
          <Input
            aria-label="Buscar contratos"
            placeholder="Buscar por contrato, fornecedor ou nº"
            value={search}
            onChange={(event) => {
              setPage(1);
              onSearch(event.target.value);
            }}
          />
        </div>
        <div className="contract-filter-groups">
          <MultiFilter
            label="Status"
            values={statuses}
            selected={statusFilters}
            onToggle={(value) =>
              toggleFilter(value, statusFilters, setStatusFilters)
            }
          />
          <MultiFilter
            label="Vencimento"
            values={['30 dias', '60 dias', '90 dias']}
            selected={expiryFilters.map((value) => `${value} dias`)}
            onToggle={(value) => {
              const limit = Number(value.split(' ')[0]);
              toggleFilter(limit, expiryFilters, setExpiryFilters);
            }}
          />
          <MultiFilter
            label="Vertical"
            values={[...VERTICAL_OPTIONS]}
            selected={verticalFilters}
            onToggle={(value) =>
              toggleFilter(value, verticalFilters, setVerticalFilters)
            }
          />
          <MultiFilter
            label="Setor"
            values={[...SECTOR_OPTIONS]}
            selected={sectorFilters}
            onToggle={(value) =>
              toggleFilter(value, sectorFilters, setSectorFilters)
            }
          />
        </div>
        <span className="result-count">
          {filteredItems.length} de {total} contratos
        </span>
        <Button type="button" className="contracts-new-button" onClick={onNew}>
          <Plus size={16} />
          Novo contrato
        </Button>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {[
                'Contrato',
                'Vertical',
                'Setor',
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
            {pageItems.map((item) => (
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
                <td>{item.squad}</td>
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
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum contrato encontrado</strong>
            <span>Ajuste os filtros ou cadastre um novo contrato.</span>
          </div>
        ) : null}
      </div>
      <div className="pagination-bar">
        <label>
          Exibir
          <select
            value={pageSize}
            onChange={(event) => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}
            aria-label="Contratos por página"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          por página
        </label>
        <span>
          {firstResult}–{lastResult} de {filteredItems.length}
        </span>
        <div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft />
          </Button>
          <strong>
            {currentPage} de {pageCount}
          </strong>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </section>
  );
}

function MultiFilter({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <details className="multi-filter">
      <summary>
        {label}
        {selected.length ? <span>{selected.length}</span> : null}
      </summary>
      <div>
        {values.map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
            />
            <span>{value}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function DetailView({
  contract,
  history,
  tab,
  onTab,
  onBack,
  onPreview,
  onDownload,
  onEdit,
  onCancelContract,
  onRenewContract,
}: {
  contract: Contract;
  history: ContractHistoryEntry[];
  tab: 'summary' | 'documents' | 'history';
  onTab: (tab: 'summary' | 'documents' | 'history') => void;
  onBack: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onCancelContract: () => Promise<void>;
  onRenewContract: () => Promise<void>;
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
        ['Setor responsável', contract.squad],
        ['Nome do responsável', contract.manager],
        [
          'E-mails para notificações',
          contract.notificationEmails?.join('; ') || 'Não informado',
        ],
      ],
    ],
    [
      'Escopo e operação',
      [
        ['Vertical', contract.destination],
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
  return (
    <section className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ChevronLeft /> Voltar para contratos
      </button>
      {contract.status !== 'Cancelado' && decisionDays <= 30 ? (
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
          <Button variant="outline" onClick={onEdit}>
            Editar contrato
          </Button>
          <Button
            variant="outline"
            onClick={onRenewContract}
            disabled={contract.status === 'Cancelado'}
          >
            Registrar renovação
          </Button>
          <Button
            variant="destructive"
            onClick={onCancelContract}
            disabled={contract.status === 'Cancelado'}
          >
            {contract.status === 'Cancelado'
              ? 'Contrato cancelado'
              : 'Cancelar contrato'}
          </Button>
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
          {history.map((entry, index) => (
            <div className="history-item" key={entry.id}>
              <div className="history-track">
                <span className={entry.tone} />
                {index < history.length - 1 ? <i /> : null}
              </div>
              <div>
                <strong>{entry.action}</strong>
                <p>{entry.detail}</p>
                <code>
                  {new Date(entry.occurredAt).toLocaleString('pt-BR')} ·{' '}
                  {entry.actor}
                </code>
              </div>
            </div>
          ))}
          {history.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma ação registrada</strong>
              <span>As próximas alterações aparecerão aqui com o usuário.</span>
            </div>
          ) : null}
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
  initial,
  autoRenew,
  hasPenalty,
  onAutoRenew,
  onPenalty,
  onCancel,
  onSave,
}: {
  initial?: Contract;
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
        const form = event.currentTarget;
        const formData = new FormData(form);
        const startValue = formData.get('start');
        const endValue = formData.get('end');
        const start = typeof startValue === 'string' ? startValue : '';
        const end = typeof endValue === 'string' ? endValue : '';
        const endInput = form.elements.namedItem('end') as HTMLInputElement;
        const notificationInput = form.elements.namedItem(
          'notificationEmails',
        ) as HTMLInputElement;
        const emails = notificationInput.value
          .split(';')
          .map((email) => email.trim())
          .filter(Boolean);
        endInput.setCustomValidity(
          start && end && end <= start
            ? 'O fim da vigência deve ser posterior ao início.'
            : '',
        );
        notificationInput.setCustomValidity(
          emails.length > 0 &&
            emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            ? ''
            : 'Informe e-mails válidos separados por ponto e vírgula.',
        );
        if (!form.reportValidity()) return;
        await onSave(formData);
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
            defaultValue={initial?.name}
            placeholder="Ex.: Plataforma de logística"
          />
        </Field>
        <Field label="Fornecedor">
          <input
            name="vendor"
            required
            defaultValue={initial?.vendor}
            placeholder="Razão social"
          />
        </Field>
        <Field label="CNPJ">
          <input
            name="cnpj"
            required
            className="mono"
            defaultValue={initial?.cnpj}
            inputMode="numeric"
            maxLength={18}
            pattern="\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}"
            placeholder="00.000.000/0000-00"
            title="Informe os 14 números do CNPJ"
            onInput={(event) => {
              event.currentTarget.value = formatCnpjInput(
                event.currentTarget.value,
              );
            }}
          />
        </Field>
        <Field label="Vertical">
          <select
            name="destination"
            required
            defaultValue={initial?.destination ?? ''}
          >
            <option value="" disabled>
              Selecione
            </option>
            {initial?.destination &&
            !VERTICAL_OPTIONS.some((item) => item === initial.destination) ? (
              <option>{initial.destination}</option>
            ) : null}
            {VERTICAL_OPTIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Criticidade">
          <select
            name="criticality"
            defaultValue={initial?.criticality ?? 'Alta'}
          >
            <option>Alta</option>
            <option>Média</option>
            <option>Baixa</option>
          </select>
        </Field>
      </FormSection>
      <FormSection title="Vigência e renovação">
        <Field label="Início da vigência">
          <input
            name="start"
            required
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            defaultValue={toDateInput(initial?.start)}
            onInput={limitDateYear}
          />
        </Field>
        <Field label="Fim da vigência">
          <input
            name="end"
            required
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            defaultValue={toDateInput(initial?.end)}
            onInput={limitDateYear}
          />
        </Field>
        <SwitchBlock
          title="Contrato possui renovação automática?"
          text="Se ativo, o sistema dispara alertas antes da data-limite de decisão."
          checked={autoRenew}
          onChange={onAutoRenew}
        />
        {autoRenew ? (
          <Field label="Renova por">
            <select
              name="renewalPeriodMonths"
              defaultValue={String(initial?.renewalPeriodMonths ?? 12)}
            >
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
              defaultValue={initial?.notice ?? 60}
            />
            <select
              name="noticeUnit"
              defaultValue={initial?.noticeUnit ?? 'calendar_days'}
            >
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
              defaultValue={initial?.penaltyBase}
              placeholder="Ex.: 30% do valor remanescente"
            />
          </Field>
        ) : null}
      </FormSection>
      <FormSection title="Financeiro" three>
        <Field label="Formato de cobrança">
          <select name="billing" defaultValue={initial?.billing ?? 'Mensal'}>
            <option>Mensal</option>
            <option>Trimestral</option>
            <option>Semestral</option>
            <option>Anual</option>
            <option>Por uso / variável</option>
            <option>Pagamento único</option>
          </select>
        </Field>
        <Field label="Valor">
          <input
            name="value"
            required
            className="mono"
            inputMode="numeric"
            defaultValue={formatCurrencyValue(initial?.value)}
            placeholder="R$ 0,00"
            onInput={(event) => {
              event.currentTarget.value = formatCurrencyInput(
                event.currentTarget.value,
              );
            }}
          />
        </Field>
        <Field label="Índice de reajuste">
          <select
            name="adjustment"
            defaultValue={initial?.adjustment ?? 'IPCA'}
          >
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
            maxLength={20}
            defaultValue={initial?.costCenter}
            placeholder="Ex.: FIN2026 ou CC-0001"
          />
        </Field>
        <Field label="Setor responsável">
          <select name="squad" required defaultValue={initial?.squad}>
            {initial?.squad &&
            !SECTOR_OPTIONS.some((item) => item === initial.squad) ? (
              <option>{initial.squad}</option>
            ) : null}
            {SECTOR_OPTIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Nome do responsável">
          <input name="manager" required defaultValue={initial?.manager} />
        </Field>
        <Field
          label="E-mails para notificações"
          span
          hint="Separe múltiplos endereços com ponto e vírgula (;)."
        >
          <input
            name="notificationEmails"
            required
            defaultValue={initial?.notificationEmails?.join('; ') ?? ''}
            placeholder="responsavel@empresa.com.br; gestor@empresa.com.br"
            onInput={(event) => event.currentTarget.setCustomValidity('')}
          />
        </Field>
      </FormSection>
      <FormSection title="Operação e conformidade">
        <Field label="SLA contratado">
          <input
            name="sla"
            defaultValue={initial?.sla}
            placeholder="Ex.: 99,5% de disponibilidade"
          />
        </Field>
        <Field label="Sistemas integrados">
          <input
            name="systems"
            defaultValue={initial?.systems === '—' ? '' : initial?.systems}
            placeholder="OMS, ERP, CRM..."
          />
        </Field>
        <Field label="Observações de confidencialidade / LGPD" span>
          <textarea name="lgpd" rows={4} defaultValue={initial?.lgpd} />
        </Field>
      </FormSection>
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {initial ? 'Salvar alterações' : 'Salvar contrato'}
        </Button>
      </div>
    </form>
  );
}

function formatCnpjInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(digits) / 100);
}

function formatCurrencyValue(value?: number) {
  if (value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function toDateInput(value?: string) {
  if (!value) return '';
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function limitDateYear(event: React.SyntheticEvent<HTMLInputElement>) {
  const [year] = event.currentTarget.value.split('-');
  if (year.length > 4) event.currentTarget.value = '';
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
  year,
  onNavigate,
  onSelectDate,
  onOpen,
}: {
  contracts: Contract[];
  month: number;
  year: number;
  onNavigate: (direction: -1 | 1) => void;
  onSelectDate: (month: number, year: number) => void;
  onOpen: (id: string) => void;
}) {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [period, setPeriod] = useState('all');
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
  const offset = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: offset + total }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  const firstYear = Math.min(2020, year);
  const lastYear = Math.max(2040, year);
  const yearOptions = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );
  const periodMonths: Record<string, number[]> = {
    all: Array.from({ length: 12 }, (_, index) => index),
    s1: [0, 1, 2, 3, 4, 5],
    s2: [6, 7, 8, 9, 10, 11],
    q1: [0, 1, 2],
    q2: [3, 4, 5],
    q3: [6, 7, 8],
    q4: [9, 10, 11],
  };
  const eventsForMonth = (targetMonth: number) =>
    contracts.flatMap((contract) => {
      const end = new Date(`${contract.endDate}T12:00:00`);
      const decision = decisionDate(contract);
      const events: {
        day: number;
        label: string;
        tone: Tone;
        id: string;
      }[] = [];
      if (end.getFullYear() === year && end.getMonth() === targetMonth)
        events.push({
          day: end.getDate(),
          label: `Fim · ${contract.name}`,
          tone: 'danger',
          id: contract.id,
        });
      if (
        decision.getFullYear() === year &&
        decision.getMonth() === targetMonth
      )
        events.push({
          day: decision.getDate(),
          label: `Aviso · ${contract.vendor}`,
          tone: 'warning',
          id: contract.id,
        });
      return events;
    });
  return (
    <section className="calendar-page">
      <div className="calendar-toolbar">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Mês anterior"
          onClick={() =>
            mode === 'month' ? onNavigate(-1) : onSelectDate(month, year - 1)
          }
        >
          <ChevronLeft />
        </Button>
        <div className="calendar-date-selectors">
          <select
            value={month}
            aria-label="Selecionar mês"
            onChange={(event) => onSelectDate(Number(event.target.value), year)}
          >
            {names.map((name, index) => (
              <option value={index} key={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={year}
            aria-label="Selecionar ano"
            onChange={(event) =>
              onSelectDate(month, Number(event.target.value))
            }
          >
            {yearOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Próximo mês"
          onClick={() =>
            mode === 'month' ? onNavigate(1) : onSelectDate(month, year + 1)
          }
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
        <div className="calendar-mode-controls">
          <button
            type="button"
            className={mode === 'month' ? 'active' : ''}
            onClick={() => setMode('month')}
          >
            Mês
          </button>
          <button
            type="button"
            className={mode === 'year' ? 'active' : ''}
            onClick={() => setMode('year')}
          >
            Ano inteiro
          </button>
          {mode === 'year' ? (
            <select
              value={period}
              aria-label="Filtrar período do ano"
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="all">Janeiro a dezembro</option>
              <option value="s1">1º semestre</option>
              <option value="s2">2º semestre</option>
              <option value="q1">1º trimestre</option>
              <option value="q2">2º trimestre</option>
              <option value="q3">3º trimestre</option>
              <option value="q4">4º trimestre</option>
            </select>
          ) : null}
        </div>
      </div>
      {mode === 'month' ? (
        <div className="calendar-card card">
          <div className="weekday-row">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              const date = day ? new Date(year, month, day) : null;
              const today = date?.toDateString() === TODAY.toDateString();
              const events = day
                ? eventsForMonth(month).filter((event) => event.day === day)
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
                      key={`${event.id}-${event.tone}-${event.day}`}
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
      ) : (
        <div className="year-calendar-grid">
          {periodMonths[period].map((targetMonth) => {
            const events = eventsForMonth(targetMonth);
            return (
              <section className="year-month-card card" key={targetMonth}>
                <button
                  type="button"
                  className="year-month-title"
                  onClick={() => {
                    onSelectDate(targetMonth, year);
                    setMode('month');
                  }}
                >
                  <strong>{names[targetMonth]}</strong>
                  <span>{events.length} eventos</span>
                </button>
                <div>
                  {events.slice(0, 5).map((event) => (
                    <button
                      type="button"
                      key={`${event.id}-${event.tone}-${event.day}`}
                      className={event.tone}
                      onClick={() => onOpen(event.id)}
                    >
                      <code>{String(event.day).padStart(2, '0')}</code>
                      <span>{event.label}</span>
                    </button>
                  ))}
                  {events.length === 0 ? <small>Sem eventos</small> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
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
          Todas as notificações são enviadas exclusivamente ao gestor definido
          no cadastro de cada contrato.
        </span>
      </div>
      <div className="card rules-card">
        <div className="rules-header">
          <span>Gatilho</span>
          <span>Em tela</span>
          <span>E-mail</span>
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
          </div>
        ))}
      </div>
      <section className="card email-preview">
        <h2>Pré-visualização do e-mail</h2>
        <p>Modelo único usado nos gatilhos D-90, D-60 e D-30</p>
        <div>
          <header>
            <b>Assunto:</b> [Contratos] Faltam {'{{dias}}'} dias para o fim da
            vigência — Plataforma de frete inteligente
            <br />
            <b>Para:</b> gestor.contrato@webcontinental.com.br
          </header>
          <article>
            <h3>Decisão de renovação necessária</h3>
            <p>
              Faltam <strong>{'{{dias}}'} dias</strong> para o contrato{' '}
              <code>CTR-2026-0142</code> chegar ao fim em{' '}
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

function AccessView({
  users,
  onInvite,
}: {
  users: UserRecord[];
  onInvite: (input: {
    name: string;
    email: string;
    vertical: string;
    sector: string;
  }) => Promise<void>;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
          <Button
            aria-label="Convidar novo usuário"
            onClick={() => setInviteOpen(true)}
          >
            <Plus /> Convidar usuário
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'Usuário',
                  'Vertical',
                  'Setor',
                  'Contratos sob gestão',
                  'Último acesso',
                  'Situação',
                ].map((item) => (
                  <th key={item}>{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.email}>
                  <td aria-label={`Usuário: ${user.name}`}>
                    <div className="person">
                      <span
                        style={{ background: colors[index % colors.length] }}
                      >
                        {user.initials}
                      </span>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{user.vertical}</td>
                  <td>{user.sector}</td>
                  <td>{user.managedContracts}</td>
                  <td>
                    <code>
                      {user.lastAccessAt
                        ? new Date(user.lastAccessAt).toLocaleString('pt-BR')
                        : '—'}
                    </code>
                  </td>
                  <td>
                    <Pill
                      tone={user.status === 'Ativo' ? 'success' : 'warning'}
                    >
                      {user.status}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setInviteError('');
        }}
      >
        <DialogContent className="invite-dialog" showCloseButton>
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              Cadastre os dados de acesso e organização do novo usuário.
            </DialogDescription>
          </DialogHeader>
          <form
            className="invite-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const value = (field: string) => {
                const entry = data.get(field);
                return typeof entry === 'string' ? entry.trim() : '';
              };
              setInviteError('');
              setSubmitting(true);
              try {
                await onInvite({
                  name: value('name'),
                  email: value('email'),
                  vertical: value('vertical'),
                  sector: value('sector'),
                });
                form.reset();
                setInviteOpen(false);
              } catch (error) {
                setInviteError(
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível enviar o convite.',
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Field label="Nome completo" span>
              <input name="name" required placeholder="Nome do usuário" />
            </Field>
            <Field label="E-mail" span>
              <input
                name="email"
                required
                type="email"
                placeholder="nome@empresa.com.br"
              />
            </Field>
            <Field label="Vertical">
              <select name="vertical" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {VERTICAL_OPTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Setor">
              <select name="sector" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {SECTOR_OPTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            {inviteError ? (
              <p className="form-error" role="alert">
                {inviteError}
              </p>
            ) : null}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
      `Prestação de serviços de ${contract.name.toLowerCase()} pela CONTRATADA ${contract.vendor}, inscrita no CNPJ sob o nº ${contract.cnpj}, para a vertical ${contract.destination} da CONTRATANTE.`,
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
