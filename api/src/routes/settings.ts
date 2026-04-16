import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const updateSettingSchema = z.object({
  value: z.string(),
});

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings/:key', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const result = await fastify.db.query(
      'SELECT key, value, updated_at, updated_by FROM settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Configuración no encontrada' });
    }

    return result.rows[0];
  });

  fastify.put('/api/settings/:key', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { key } = request.params as { key: string };
    const { value } = updateSettingSchema.parse(request.body);
    const result = await fastify.db.query(
      `INSERT INTO settings (key, value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (key)
       DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING key, value, updated_at, updated_by`,
      [key, value, request.user.userId]
    );

    return result.rows[0];
  });
}
