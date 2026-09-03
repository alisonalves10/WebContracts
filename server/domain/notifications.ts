import { z } from 'zod';

export const notificationRulePatchSchema = z
  .object({
    screen: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .refine((value) => value.screen !== undefined || value.email !== undefined, {
    message: 'Informe ao menos um canal para atualizar',
  });

export type NotificationRulePatch = z.infer<typeof notificationRulePatchSchema>;
