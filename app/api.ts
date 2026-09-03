import type { Contract } from './data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export async function fetchContracts(signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/api/contracts`, { signal });
  if (!response.ok) throw new Error('Não foi possível carregar os contratos');
  const body = (await response.json()) as ApiResponse<Contract[]>;
  if (!body.data) throw new Error(body.error);
  return body.data;
}

export async function createContract(input: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/api/contracts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as ApiResponse<Contract> & {
    issues?: unknown;
  };
  if (!response.ok || !body.data)
    throw new Error(body.error ?? 'Não foi possível salvar o contrato');
  return body.data;
}

export async function updateContract(
  id: string,
  input: Record<string, unknown>,
) {
  const response = await fetch(`${API_URL}/api/contracts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as ApiResponse<Contract>;
  if (!response.ok || !body.data)
    throw new Error(body.error ?? 'Não foi possível atualizar o contrato');
  return body.data;
}

export async function cancelContract(id: string) {
  return runContractAction(
    id,
    'cancel',
    'Não foi possível cancelar o contrato',
  );
}

export async function renewContract(id: string) {
  return runContractAction(
    id,
    'renew',
    'Não foi possível registrar a renovação',
  );
}

async function runContractAction(id: string, action: string, message: string) {
  const response = await fetch(`${API_URL}/api/contracts/${id}/${action}`, {
    method: 'POST',
  });
  const body = (await response.json()) as ApiResponse<Contract>;
  if (!response.ok || !body.data) throw new Error(body.error ?? message);
  return body.data;
}

export type ContractHistoryEntry = {
  id: number;
  action: string;
  detail: string;
  actor: string;
  occurredAt: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

export async function fetchContractHistory(id: string) {
  const response = await fetch(`${API_URL}/api/contracts/${id}/history`);
  const body = (await response.json()) as ApiResponse<ContractHistoryEntry[]>;
  if (!response.ok || !body.data)
    throw new Error(body.error ?? 'Não foi possível carregar o histórico');
  return body.data;
}

export function contractPayload(
  formData: FormData,
  automatic: boolean,
  penalty: boolean,
  existingId?: string,
) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const brazilianDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };
  const numericValue = text('value')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return {
    id:
      existingId ??
      `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    name: text('name'),
    vendor: text('vendor'),
    cnpj: text('cnpj'),
    destination: text('destination'),
    criticality: text('criticality'),
    status: 'Vigente',
    start: brazilianDate(text('start')),
    end: brazilianDate(text('end')),
    automatic,
    renewalPeriodMonths: automatic
      ? Number(text('renewalPeriodMonths') || 12)
      : null,
    notice: Number(text('notice')),
    noticeUnit: text('noticeUnit'),
    penalty,
    penaltyBase: penalty ? text('penaltyBase') : null,
    billing: text('billing'),
    value:
      text('billing') === 'Por uso / variável' ? null : Number(numericValue),
    adjustment: text('adjustment'),
    costCenter: text('costCenter'),
    squad: text('squad'),
    manager: text('manager'),
    sla: text('sla') || null,
    systems: text('systems')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    lgpd: text('lgpd') || null,
  };
}
