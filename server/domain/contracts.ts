import { z } from 'zod';

export const contractInputSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^CTR-\d{4}-\d{4}$/),
    name: z.string().trim().min(3).max(220),
    vendor: z.string().trim().min(2).max(180),
    cnpj: z.string().trim().refine(isValidCnpj, 'CNPJ inválido'),
    destination: z.string().trim().min(1).max(80),
    criticality: z.enum(['Alta', 'Média', 'Baixa']),
    status: z.enum(['Vigente', 'Em renovação', 'Encerrado']).default('Vigente'),
    start: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    end: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    automatic: z.boolean(),
    renewalPeriodMonths: z.number().int().positive().nullable().default(12),
    notice: z.number().int().positive(),
    noticeUnit: z
      .enum(['calendar_days', 'business_days', 'months'])
      .default('calendar_days'),
    penalty: z.boolean(),
    penaltyBase: z.string().trim().nullable().default(null),
    billing: z.enum([
      'Mensal',
      'Trimestral',
      'Semestral',
      'Anual',
      'Por uso / variável',
      'Pagamento único',
    ]),
    value: z.number().nonnegative().nullable(),
    adjustment: z.enum(['IPCA', 'IGP-M', 'INPC', 'Sem reajuste']),
    costCenter: z
      .string()
      .trim()
      .regex(/^CC-\d{4}$/),
    squad: z.string().trim().min(1).max(100),
    manager: z.string().trim().min(2).max(160),
    sla: z.string().trim().max(2000).nullable().default(null),
    systems: z.array(z.string().trim().min(1)).default([]),
    lgpd: z.string().trim().max(5000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (parseBrazilianDate(value.end) <= parseBrazilianDate(value.start)) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'O fim deve ser posterior ao início',
      });
    }
    if (value.automatic && !value.renewalPeriodMonths) {
      context.addIssue({
        code: 'custom',
        path: ['renewalPeriodMonths'],
        message: 'Informe o período da renovação',
      });
    }
    if (value.penalty && !value.penaltyBase) {
      context.addIssue({
        code: 'custom',
        path: ['penaltyBase'],
        message: 'Informe a base da multa',
      });
    }
    if (value.billing !== 'Por uso / variável' && value.value === null) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Informe o valor do contrato',
      });
    }
  });

export type ContractInput = z.infer<typeof contractInputSchema>;

export function parseBrazilianDate(value: string) {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function toBrazilianDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function calculateDecisionDeadline(
  end: string,
  quantity: number,
  unit: ContractInput['noticeUnit'],
  holidays = new Set<string>(),
) {
  const result = parseBrazilianDate(end);
  if (unit === 'months') {
    result.setUTCMonth(result.getUTCMonth() - quantity);
    return toIsoDate(result);
  }
  let remaining = quantity;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() - 1);
    const isoDate = toIsoDate(result);
    if (
      unit === 'calendar_days' ||
      (result.getUTCDay() !== 0 &&
        result.getUTCDay() !== 6 &&
        !holidays.has(isoDate))
    )
      remaining -= 1;
  }
  return toIsoDate(result);
}

function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(digits[index]) * factor--;
      if (factor < 2) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13])
  );
}
