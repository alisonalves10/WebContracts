import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { userInputSchema } from '../domain/users';
import { createUser, listUsers } from '../repositories/users';

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/users', async () => ({ data: await listUsers() }));

  app.post('/api/users', async (request, reply) => {
    try {
      const input = userInputSchema.parse(request.body);
      return reply.code(201).send({ data: await createUser(input) });
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
          .send({ error: 'Já existe um usuário com este e-mail' });
      throw error;
    }
  });
}
