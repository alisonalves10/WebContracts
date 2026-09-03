import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { notificationRulePatchSchema } from '../domain/notifications';
import {
  listNotificationRules,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationRule,
} from '../repositories/notifications';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/notification-rules', async () => ({
    data: await listNotificationRules(),
  }));

  app.patch<{ Params: { id: string } }>(
    '/api/notification-rules/:id',
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isInteger(id) || id <= 0)
          return reply.code(400).send({ error: 'Regra inválida' });
        const patch = notificationRulePatchSchema.parse(request.body);
        const rule = await updateNotificationRule(id, patch);
        if (!rule)
          return reply.code(404).send({ error: 'Regra não encontrada' });
        return { data: rule };
      } catch (error) {
        if (error instanceof ZodError)
          return reply
            .code(422)
            .send({ error: 'Dados inválidos', issues: error.issues });
        throw error;
      }
    },
  );

  app.get('/api/notifications', async () => ({
    data: await listNotifications(),
  }));

  app.patch<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    async (request, reply) => {
      const notification = await markNotificationRead(request.params.id);
      if (!notification)
        return reply.code(404).send({ error: 'Notificação não encontrada' });
      return { data: notification };
    },
  );

  app.post('/api/notifications/read-all', async () => ({
    data: await markAllNotificationsRead(),
  }));
}
