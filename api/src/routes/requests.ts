import type { FastifyInstance } from 'fastify';

export default async function requestRoutes(fastify: FastifyInstance) {
  // Listar solicitudes (comisión)
  fastify.get('/api/requests', {
    preHandler: [fastify.requireCommittee],
  }, async () => {
    const result = await fastify.db.query(`
      SELECT ar.*, f.name as family_name, u.name as submitted_by_name,
        p.name as period_name
      FROM aid_requests ar
      JOIN families f ON f.id = ar.family_id
      JOIN aid_periods p ON p.id = ar.period_id
      LEFT JOIN users u ON u.id = ar.submitted_by
      ORDER BY ar.created_at DESC
    `);
    return result.rows;
  });

  // Ver solicitud con form_snapshot (comisión)
  fastify.get('/api/requests/:id', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await fastify.db.query(`
      SELECT ar.*, f.name as family_name, f.email as family_email,
        f.address, f.locality, f.postal_code, f.phone as family_phone,
        u.name as submitted_by_name, p.name as period_name
      FROM aid_requests ar
      JOIN families f ON f.id = ar.family_id
      JOIN aid_periods p ON p.id = ar.period_id
      LEFT JOIN users u ON u.id = ar.submitted_by
      WHERE ar.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Solicitud no encontrada' });
    }

    return result.rows[0];
  });

  // Eliminar solicitud (comisión — para permitir reenvío)
  fastify.delete('/api/requests/:id', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await fastify.db.query('DELETE FROM aid_requests WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Solicitud no encontrada' });
    }
    return { ok: true };
  });
}
