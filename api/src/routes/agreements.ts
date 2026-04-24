import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createAgreementSchema = z.object({
  family_id: z.number().int().positive(),
  period_id: z.number().int().positive(),
  discount_percentage: z.number().min(0).max(100),
  observations: z.string().optional(),
  impact_starts_at: z.string().optional(),
  expires_at: z.string().optional(),
});

export default async function agreementRoutes(fastify: FastifyInstance) {
  // Listar acuerdos del período activo (o uno específico)
  fastify.get('/api/agreements', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };

    const result = await fastify.db.query(`
      SELECT a.*,
        json_agg(json_build_object(
          'id', ast.id,
          'student_id', ast.student_id,
          'student_name', s.name,
          'level', ast.level,
          'base_tuition', ast.base_tuition,
          'extras', ast.extras,
          'discount_percentage', ast.discount_percentage,
          'discount_amount', ast.discount_amount,
          'amount_to_pay', ast.amount_to_pay
        )) FILTER (WHERE ast.id IS NOT NULL) AS students
      FROM agreements a
      LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      LEFT JOIN students s ON s.id = ast.student_id
      WHERE a.period_id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `, [period_id ?? null]);

    return result.rows;
  });

  // Detalle de un acuerdo
  fastify.get('/api/agreements/:id', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await fastify.db.query(`
      SELECT a.*,
        json_agg(json_build_object(
          'id', ast.id,
          'student_id', ast.student_id,
          'student_name', s.name,
          'level', ast.level,
          'base_tuition', ast.base_tuition,
          'extras', ast.extras,
          'discount_percentage', ast.discount_percentage,
          'discount_amount', ast.discount_amount,
          'amount_to_pay', ast.amount_to_pay
        )) FILTER (WHERE ast.id IS NOT NULL) AS students
      FROM agreements a
      LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      LEFT JOIN students s ON s.id = ast.student_id
      WHERE a.id = $1
      GROUP BY a.id
    `, [id]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    return result.rows[0];
  });

  // Crear acuerdo — calcula automáticamente montos por estudiante
  fastify.post('/api/agreements', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request) => {
    const data = createAgreementSchema.parse(request.body);
    const client = await fastify.db.connect();

    try {
      await client.query('BEGIN');

      // Crear acuerdo (sin campo status — el status vive en la familia)
      const agreementResult = await client.query(
        `INSERT INTO agreements (family_id, period_id, discount_percentage, observations, approved_by, granted_at, impact_starts_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6::date, $7::date)
         RETURNING *`,
        [
          data.family_id,
          data.period_id,
          data.discount_percentage,
          data.observations,
          request.user.userId,
          data.impact_starts_at ?? '2026-02-01',
          data.expires_at ?? '2026-08-31',
        ]
      );
      const agreement = agreementResult.rows[0];

      // Obtener estudiantes de la familia y cuotas del período
      const studentsResult = await client.query(
        'SELECT * FROM students WHERE family_id = $1', [data.family_id]
      );

      // Obtener rates del tarifario vigente
      const ratesResult = await client.query(`
        SELECT fsr.* FROM fee_schedule_rates fsr
        JOIN fee_schedules fs ON fs.id = fsr.fee_schedule_id
        WHERE fs.effective_from <= CURRENT_DATE
        ORDER BY fs.effective_from DESC
      `);
      // Filtrar solo las rates del tarifario más reciente
      const activeScheduleId = ratesResult.rows[0]?.fee_schedule_id;
      const activeRates = ratesResult.rows.filter(
        (r: { fee_schedule_id: number }) => r.fee_schedule_id === activeScheduleId
      );
      const ratesByLevel = new Map(activeRates.map((r: { level: string }) => [r.level, r]));

      // Crear detalle por estudiante
      for (const student of studentsResult.rows) {
        const rate = ratesByLevel.get(student.level) as { tuition_amount: number; extras_amount: number } | undefined;
        if (!rate) continue;

        const baseTuition = Number(rate.tuition_amount);
        const extras = Number(rate.extras_amount);
        const discountAmount = baseTuition * (data.discount_percentage / 100);
        const amountToPay = baseTuition - discountAmount + extras;

        await client.query(
          `INSERT INTO agreement_students
           (agreement_id, student_id, level, base_tuition, extras, discount_percentage, discount_amount, amount_to_pay)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            agreement.id,
            student.id,
            student.level,
            baseTuition,
            extras,
            data.discount_percentage,
            discountAmount,
            amountToPay,
          ]
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO agreement_audit_log (agreement_id, action, new_values, changed_by)
         VALUES ($1, 'created', $2, $3)`,
        [agreement.id, JSON.stringify(data), request.user.userId]
      );

      await client.query('COMMIT');
      return agreement;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Actualizar acuerdo (solo % y observaciones)
  fastify.put('/api/agreements/:id', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createAgreementSchema.partial().parse(request.body);
    const client = await fastify.db.connect();

    try {
      await client.query('BEGIN');

      const oldResult = await client.query('SELECT * FROM agreements WHERE id = $1', [id]);
      if (oldResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Acuerdo no encontrado' });
      }
      const old = oldResult.rows[0];

      const result = await client.query(
        `UPDATE agreements SET
          discount_percentage = COALESCE($1, discount_percentage),
          observations = COALESCE($2, observations),
          impact_starts_at = COALESCE($3::date, impact_starts_at),
          expires_at = COALESCE($4::date, expires_at),
          updated_at = NOW()
        WHERE id = $5 RETURNING *`,
        [data.discount_percentage, data.observations, data.impact_starts_at, data.expires_at, id]
      );

      // Si cambió el descuento, recalcular montos por estudiante
      if (data.discount_percentage !== undefined && data.discount_percentage !== Number(old.discount_percentage)) {
        // Obtener rates del tarifario vigente
        const ratesResult = await client.query(`
          SELECT fsr.* FROM fee_schedule_rates fsr
          JOIN fee_schedules fs ON fs.id = fsr.fee_schedule_id
          WHERE fs.effective_from <= CURRENT_DATE
          ORDER BY fs.effective_from DESC
        `);
        const activeScheduleId = ratesResult.rows[0]?.fee_schedule_id;
        const activeRates = ratesResult.rows.filter(
          (r: { fee_schedule_id: number }) => r.fee_schedule_id === activeScheduleId
        );
        const ratesByLevel = new Map(activeRates.map((r: { level: string }) => [r.level, r]));

        const studentsResult = await client.query(
          'SELECT ast.*, s.level as student_level FROM agreement_students ast JOIN students s ON s.id = ast.student_id WHERE ast.agreement_id = $1',
          [id]
        );

        for (const as of studentsResult.rows) {
          const rate = ratesByLevel.get(as.student_level) as { tuition_amount: number; extras_amount: number } | undefined;
          if (!rate) continue;

          const baseTuition = Number(rate.tuition_amount);
          const extras = Number(rate.extras_amount);
          const discountAmount = baseTuition * (data.discount_percentage / 100);
          const amountToPay = baseTuition - discountAmount + extras;

          await client.query(
            `UPDATE agreement_students SET
              discount_percentage = $1, discount_amount = $2, amount_to_pay = $3,
              base_tuition = $4, extras = $5
            WHERE id = $6`,
            [data.discount_percentage, discountAmount, amountToPay, baseTuition, extras, as.id]
          );
        }
      }

      // Audit log
      await client.query(
        `INSERT INTO agreement_audit_log (agreement_id, action, old_values, new_values, changed_by)
         VALUES ($1, 'updated', $2, $3, $4)`,
        [id, JSON.stringify(old), JSON.stringify(data), request.user.userId]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Eliminar acuerdo — vuelve familia a en_definicion
  fastify.delete('/api/agreements/:id', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await fastify.db.query('SELECT * FROM agreements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    await fastify.db.query('DELETE FROM agreements WHERE id = $1', [id]);

    // Volver familia a en_definicion
    await fastify.db.query(
      `UPDATE families SET status = 'en_definicion'::family_status WHERE id = $1`,
      [existing.rows[0].family_id]
    );

    return { ok: true };
  });
}
