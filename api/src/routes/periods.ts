import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createPeriodSchema = z.object({
  name: z.string().min(1),
  start_month: z.number().int().min(1).max(12),
  end_month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  total_budget: z.number().min(0),
});

const createTuitionRateSchema = z.object({
  period_id: z.number().int().positive(),
  level: z.enum(['jardin', 'primaria', 'secundaria', '12vo']),
  tuition_amount: z.number().min(0),
  extras_amount: z.number().min(0).default(0),
});

export default async function periodRoutes(fastify: FastifyInstance) {
  // Listar períodos
  fastify.get('/api/periods', {
    preHandler: [fastify.requireCommittee],
  }, async () => {
    const result = await fastify.db.query('SELECT * FROM aid_periods ORDER BY year DESC, start_month DESC');
    return result.rows;
  });

  // Período activo
  fastify.get('/api/periods/active', {
    preHandler: [fastify.requireAuth],
  }, async (_, reply) => {
    const result = await fastify.db.query('SELECT * FROM aid_periods WHERE is_active = true LIMIT 1');
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'No hay período activo' });
    }
    return result.rows[0];
  });

  // Crear período
  fastify.post('/api/periods', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const data = createPeriodSchema.parse(request.body);
    const result = await fastify.db.query(
      `INSERT INTO aid_periods (name, start_month, end_month, year, total_budget)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.start_month, data.end_month, data.year, data.total_budget]
    );
    return result.rows[0];
  });

  // Cuotas por nivel
  fastify.get('/api/tuition-rates', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };
    const result = await fastify.db.query(
      `SELECT * FROM tuition_rates
       WHERE period_id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
       ORDER BY level`,
      [period_id ?? null]
    );
    return result.rows;
  });

  // Crear/actualizar cuota
  fastify.post('/api/tuition-rates', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const data = createTuitionRateSchema.parse(request.body);
    const result = await fastify.db.query(
      `INSERT INTO tuition_rates (period_id, level, tuition_amount, extras_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (period_id, level) DO UPDATE SET
         tuition_amount = EXCLUDED.tuition_amount,
         extras_amount = EXCLUDED.extras_amount
       RETURNING *`,
      [data.period_id, data.level, data.tuition_amount, data.extras_amount]
    );
    return result.rows[0];
  });
}
