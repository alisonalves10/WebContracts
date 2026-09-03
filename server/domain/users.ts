import { z } from 'zod';

export const userInputSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z.email().trim().toLowerCase().max(255),
  vertical: z.string().trim().min(1).max(100),
  sector: z.string().trim().min(1).max(100),
});

export type UserInput = z.infer<typeof userInputSchema>;
