import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import { db, closeDatabase } from './db';
import { env } from './env';
import { contractRoutes } from './routes/contracts';

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
});

app.get('/api/health', async () => {
  await db.execute(sql`select 1`);
  return { status: 'ok', database: 'postgresql' };
});

await app.register(contractRoutes);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await app.close();
  await closeDatabase();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
