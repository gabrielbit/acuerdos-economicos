import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createFeeScheduleSchema = z.object({
  name: z.string().min(1),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_budget: z.number().min(0),
  rates: z.array(z.object({
    level: z.enum(['jardin', 'primaria', 'secundaria', '12vo']),
    tuition_amount: z.number().min(0),
    extras_amount: z.number().min(0).default(0),
  })).min(1),
});

export default async function feeScheduleRoutes(fastify: FastifyInstance) {
  // Listar todos los tarifarios
  fastify.get('/api/fee-schedules', {
    preHandler: [fastify.requireCommittee],
  }, async () => {
    const result = await fastify.db.query(`
      SELECT fs.*,
        json_agg(json_build_object(
          'id', fsr.id,
          'level', fsr.level,
          'tuition_amount', fsr.tuition_amount,
          'extras_amount', fsr.extras_amount
        ) ORDER BY fsr.level) AS rates
      FROM fee_schedules fs
      LEFT JOIN fee_schedule_rates fsr ON fsr.fee_schedule_id = fs.id
      GROUP BY fs.id
      ORDER BY fs.effective_from DESC
    `);
    return result.rows;
  });

  // Tarifario activo (vigente hoy)
  fastify.get('/api/fee-schedules/active', {
    preHandler: [fastify.requireCommittee],
  }, async (_, reply) => {
    const result = await fastify.db.query(`
      SELECT fs.*,
        json_agg(json_build_object(
          'id', fsr.id,
          'level', fsr.level,
          'tuition_amount', fsr.tuition_amount,
          'extras_amount', fsr.extras_amount
        ) ORDER BY fsr.level) AS rates
      FROM fee_schedules fs
      LEFT JOIN fee_schedule_rates fsr ON fsr.fee_schedule_id = fs.id
      WHERE fs.effective_from <= CURRENT_DATE
      GROUP BY fs.id
      ORDER BY fs.effective_from DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'No hay tarifario vigente' });
    }

    return result.rows[0];
  });

  // Crear tarifario + recalcular agreement_students del período activo
  fastify.post('/api/fee-schedules', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request) => {
    const data = createFeeScheduleSchema.parse(request.body);
    const client = await fastify.db.connect();

    try {
      await client.query('BEGIN');

      const fsResult = await client.query(
        `INSERT INTO fee_schedules (name, effective_from, total_budget)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.name, data.effective_from, data.total_budget]
      );
      const feeSchedule = fsResult.rows[0];

      for (const rate of data.rates) {
        await client.query(
          `INSERT INTO fee_schedule_rates (fee_schedule_id, level, tuition_amount, extras_amount)
           VALUES ($1, $2, $3, $4)`,
          [feeSchedule.id, rate.level, rate.tuition_amount, rate.extras_amount]
        );
      }

      // Recalcular agreement_students del período activo si este tarifario es el nuevo vigente
      const isActive = await client.query(
        `SELECT 1 FROM fee_schedules
         WHERE effective_from <= CURRENT_DATE
         ORDER BY effective_from DESC LIMIT 1`,
      );

      if (isActive.rows.length > 0) {
        const activeScheduleId = (await client.query(
          `SELECT id FROM fee_schedules
           WHERE effective_from <= CURRENT_DATE
           ORDER BY effective_from DESC LIMIT 1`
        )).rows[0].id;

        // Solo recalcular si el nuevo tarifario es el activo
        if (activeScheduleId === feeSchedule.id) {
          const ratesResult = await client.query(
            'SELECT * FROM fee_schedule_rates WHERE fee_schedule_id = $1',
            [feeSchedule.id]
          );
          const ratesByLevel = new Map(
            ratesResult.rows.map((r: { level: string }) => [r.level, r])
          );

          // Obtener todos los agreement_students del período activo
          const astResult = await client.query(`
            SELECT ast.id, ast.discount_percentage, s.level
            FROM agreement_students ast
            JOIN agreements a ON a.id = ast.agreement_id
            JOIN aid_periods ap ON ap.id = a.period_id AND ap.is_active = true
            JOIN students s ON s.id = ast.student_id
          `);

          for (const ast of astResult.rows) {
            const rate = ratesByLevel.get(ast.level) as { tuition_amount: number; extras_amount: number } | undefined;
            if (!rate) continue;

            const baseTuition = Number(rate.tuition_amount);
            const extras = Number(rate.extras_amount);
            const discountPct = Number(ast.discount_percentage);
            const discountAmount = baseTuition * (discountPct / 100);
            const amountToPay = baseTuition - discountAmount + extras;

            await client.query(
              `UPDATE agreement_students SET
                base_tuition = $1, extras = $2,
                discount_amount = $3, amount_to_pay = $4
              WHERE id = $5`,
              [baseTuition, extras, discountAmount, amountToPay, ast.id]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Retornar con rates incluidas
      const full = await fastify.db.query(`
        SELECT fs.*,
          json_agg(json_build_object(
            'level', fsr.level,
            'tuition_amount', fsr.tuition_amount,
            'extras_amount', fsr.extras_amount
          ) ORDER BY fsr.level) AS rates
        FROM fee_schedules fs
        JOIN fee_schedule_rates fsr ON fsr.fee_schedule_id = fs.id
        WHERE fs.id = $1
        GROUP BY fs.id
      `, [feeSchedule.id]);

      return full.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
