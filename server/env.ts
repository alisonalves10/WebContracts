import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgresql://'),
  API_PORT: z.coerce.number().int().positive().default(4001),
});

export const env = schema.parse(process.env);
