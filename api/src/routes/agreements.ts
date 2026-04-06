import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createAgreementSchema = z.object({
  family_id: z.number().int().positive(),
  period_id: z.number().int().positive(),
  discount_percentage: z.number().min(0).max(100),
  observations: z.string().optional(),
  status: z.enum(['pendiente', 'en_definicion', 'asignado', 'rechazado', 'suspendido']).optional(),
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

      // Crear acuerdo
      const initialStatus = data.status ?? 'asignado';
      const agreementResult = await client.query(
        `INSERT INTO agreements (family_id, period_id, status, discount_percentage, observations, approved_by, status_changed_at, granted_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         RETURNING *`,
        [
          data.family_id,
          data.period_id,
          initialStatus,
          data.discount_percentage,
          data.observations,
          request.user.userId,
          initialStatus === 'asignado' ? new Date() : null,
        ]
      );
      const agreement = agreementResult.rows[0];

      // Obtener estudiantes de la familia y cuotas del período
      const studentsResult = await client.query(
        'SELECT * FROM students WHERE family_id = $1', [data.family_id]
      );

      const ratesResult = await client.query(
        'SELECT * FROM tuition_rates WHERE period_id = $1', [data.period_id]
      );
      const ratesByLevel = new Map(ratesResult.rows.map((r: { level: string }) => [r.level, r]));

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

  // Actualizar acuerdo
  fastify.put('/api/agreements/:id', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createAgreementSchema.partial().parse(request.body);
    const client = await fastify.db.connect();

    try {
      await client.query('BEGIN');

      // Obtener valores anteriores
      const oldResult = await client.query('SELECT * FROM agreements WHERE id = $1', [id]);
      if (oldResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Acuerdo no encontrado' });
      }
      const old = oldResult.rows[0];

      // Actualizar acuerdo
      const newStatus = data.status ?? old.status;
      const statusChanged = data.status && data.status !== old.status;
      const grantedClause = statusChanged && newStatus === 'asignado' ? ', granted_at = NOW()' : '';
      const statusTimeClause = statusChanged ? ', status_changed_at = NOW()' : '';

      const result = await client.query(
        `UPDATE agreements SET
          discount_percentage = COALESCE($1, discount_percentage),
          observations = COALESCE($2, observations),
          status = COALESCE($3, status),
          updated_at = NOW()${statusTimeClause}${grantedClause}
        WHERE id = $4 RETURNING *`,
        [data.discount_percentage, data.observations, data.status, id]
      );

      // Si cambió el descuento, recalcular montos por estudiante
      if (data.discount_percentage !== undefined && data.discount_percentage !== Number(old.discount_percentage)) {
        const ratesResult = await client.query(
          'SELECT * FROM tuition_rates WHERE period_id = $1', [old.period_id]
        );
        const ratesByLevel = new Map(ratesResult.rows.map((r: { level: string }) => [r.level, r]));

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

  // Cambiar estado
  fastify.patch('/api/agreements/:id/status', {
    preHandler: [fastify.requirePermission('canChangeStatus')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.enum(['pendiente', 'en_definicion', 'asignado', 'rechazado', 'suspendido']) })
      .parse(request.body);

    const oldResult = await fastify.db.query('SELECT status FROM agreements WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    const grantedClause = status === 'asignado' ? ', granted_at = NOW()' : '';
    const result = await fastify.db.query(
      `UPDATE agreements SET status = $1, status_changed_at = NOW(), updated_at = NOW()${grantedClause} WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await fastify.db.query(
      `INSERT INTO agreement_audit_log (agreement_id, action, old_values, new_values, changed_by)
       VALUES ($1, 'status_change', $2, $3, $4)`,
      [id, JSON.stringify({ status: oldResult.rows[0].status }), JSON.stringify({ status }), request.user.userId]
    );

    return result.rows[0];
  });

  // Eliminar acuerdo
  fastify.delete('/api/agreements/:id', {
    preHandler: [fastify.requirePermission('canManageAgreements')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await fastify.db.query('SELECT * FROM agreements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    await fastify.db.query('DELETE FROM agreements WHERE id = $1', [id]);
    return { ok: true };
  });
}
