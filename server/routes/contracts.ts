import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { contractInputSchema } from '../domain/contracts';
import {
  createContract,
  findContract,
  listContracts,
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
}
