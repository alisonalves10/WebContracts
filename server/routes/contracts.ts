import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { contractInputSchema } from '../domain/contracts';
import {
  cancelContract,
  createContract,
  findContract,
  listContractHistory,
  listContracts,
  renewContract,
  updateContract,
} from '../repositories/contracts';

export async function contractRoutes(app: FastifyInstance) {
  app.get('/api/contracts', async () => ({ data: await listContracts() }));

  app.get<{ Params: { id: string } }>(
    '/api/contracts/:id',
    async (request, reply) => {
      const contract = await findContract(request.params.id);
      if (!contract)
        return reply.code(404).send({ error: 'Contrato não encontrado' });
      return { data: contract };
    },
  );

  app.post('/api/contracts', async (request, reply) => {
    try {
      const input = contractInputSchema.parse(request.body);
      return reply.code(201).send({ data: await createContract(input) });
    } catch (error) {
      if (error instanceof ZodError)
        return reply
          .code(422)
          .send({ error: 'Dados inválidos', issues: error.issues });
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        return reply
          .code(409)
          .send({ error: 'Já existe um contrato com este número' });
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/contracts/:id',
    async (request, reply) => {
      try {
        const input = contractInputSchema.parse({
          ...(request.body as object),
          id: request.params.id,
        });
        const contract = await updateContract(request.params.id, input);
        if (!contract)
          return reply.code(404).send({ error: 'Contrato não encontrado' });
        return { data: contract };
      } catch (error) {
        if (error instanceof ZodError)
          return reply
            .code(422)
            .send({ error: 'Dados inválidos', issues: error.issues });
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/contracts/:id/cancel',
    async (request, reply) => {
      const contract = await cancelContract(request.params.id);
      if (!contract)
        return reply.code(404).send({ error: 'Contrato não encontrado' });
      return { data: contract };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/contracts/:id/renew',
    async (request, reply) => {
      const contract = await renewContract(request.params.id);
      if (!contract)
        return reply
          .code(409)
          .send({ error: 'Contrato não encontrado ou já cancelado' });
      return { data: contract };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/contracts/:id/history',
    async (request) => ({ data: await listContractHistory(request.params.id) }),
  );
}
