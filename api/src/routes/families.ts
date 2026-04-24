import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createFamilySchema = z.object({
  name: z.string().min(1),
  parent_names: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  family_type: z.enum(['familia', 'docente']).optional(),
});

const createStudentSchema = z.object({
  name: z.string().min(1),
  level: z.enum(['jardin', 'primaria', 'secundaria', '12vo']),
  grade: z.string().min(1),
  file_number: z.string().optional(),
});

const updateStudentSchema = createStudentSchema.partial();

export default async function familyRoutes(fastify: FastifyInstance) {
  // Listar familias con datos del acuerdo del período activo
  fastify.get('/api/families', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };

    const result = await fastify.db.query(`
      SELECT
        f.id, f.name, f.parent_names, f.email, f.phone, f.user_id, f.created_at,
        f.family_type::text AS family_type, f.status::text AS status, f.interview_date,
        COUNT(DISTINCT s.id)::int AS student_count,
        a.discount_percentage,
        COALESCE(SUM(ast.base_tuition + ast.extras), 0)::numeric AS total_tuition,
        COALESCE(SUM(ast.amount_to_pay), 0)::numeric AS total_to_pay,
        COALESCE(SUM(ast.discount_amount), 0)::numeric AS total_discount
      FROM families f
      LEFT JOIN students s ON s.family_id = f.id
      LEFT JOIN agreements a ON a.family_id = f.id
        AND a.period_id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      GROUP BY f.id, a.discount_percentage
      ORDER BY f.name
    `, [period_id ?? null]);

    return result.rows;
  });

  // Próximas entrevistas (antes de :id para evitar conflicto)
  fastify.get('/api/families/interviews', {
    preHandler: [fastify.requireCommittee],
  }, async () => {
    const result = await fastify.db.query(`
      SELECT f.id, f.name, f.parent_names, f.interview_date, f.family_type::text AS family_type, f.status::text AS status
      FROM families f
      WHERE f.interview_date IS NOT NULL
        AND f.interview_date >= NOW() - INTERVAL '1 day'
        AND f.status::text IN ('agendado', 'formulario_completado')
      ORDER BY f.interview_date ASC
      LIMIT 20
    `);
    return result.rows;
  });

  // Detalle familia con estudiantes
  fastify.get('/api/families/:id', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const familyResult = await fastify.db.query(
      'SELECT * FROM families WHERE id = $1', [id]
    );
    if (familyResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
    }

    const studentsResult = await fastify.db.query(
      'SELECT * FROM students WHERE family_id = $1 ORDER BY name', [id]
    );

    return {
      ...familyResult.rows[0],
      students: studentsResult.rows,
    };
  });

  // Crear familia
  fastify.post('/api/families', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request) => {
    const data = createFamilySchema.parse(request.body);
    const result = await fastify.db.query(
      `INSERT INTO families (name, parent_names, email, phone, family_type)
       VALUES ($1, $2, $3, $4, $5::family_type)
       RETURNING *`,
      [data.name, data.parent_names, data.email, data.phone, data.family_type ?? 'familia']
    );
    return result.rows[0];
  });

  // Actualizar familia
  fastify.put('/api/families/:id', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createFamilySchema.partial().parse(request.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No hay campos para actualizar' });
    }

    values.push(id);
    const result = await fastify.db.query(
      `UPDATE families SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
    }

    return result.rows[0];
  });

  // Cambiar status de familia
  fastify.patch('/api/families/:id/status', {
    preHandler: [fastify.requirePermission('canChangeStatus')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = z.object({
      status: z.enum([
        'solicitud', 'formulario_enviado', 'formulario_completado',
        'agendado', 'en_definicion', 'otorgado', 'rechazado', 'suspendido',
      ]),
      interview_date: z.string().nullable().optional(),
    }).parse(request.body);

    if (data.status === 'otorgado') {
      const validation = await fastify.db.query(`
        WITH active_period AS (
          SELECT id
          FROM aid_periods
          WHERE is_active = true
          LIMIT 1
        ),
        family_students AS (
          SELECT COUNT(*)::int AS total_students
          FROM students
          WHERE family_id = $1
        ),
        agreement_impact AS (
          SELECT
            a.id AS agreement_id,
            COUNT(DISTINCT ast.student_id)::int AS impacted_students
          FROM agreements a
          JOIN active_period ap ON ap.id = a.period_id
          LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
          WHERE a.family_id = $1
          GROUP BY a.id
          ORDER BY a.created_at DESC
          LIMIT 1
        )
        SELECT
          fs.total_students,
          ai.agreement_id,
          COALESCE(ai.impacted_students, 0) AS impacted_students
        FROM family_students fs
        LEFT JOIN agreement_impact ai ON true
      `, [id]);

      const row = validation.rows[0] as {
        total_students: number;
        agreement_id: number | null;
        impacted_students: number;
      } | undefined;

      if (!row?.agreement_id) {
        return reply.status(400).send({
          error: 'Para otorgar, la familia debe tener un acuerdo activo.',
        });
      }

      if (row.total_students <= 0) {
        return reply.status(400).send({
          error: 'Para otorgar, la familia debe tener al menos un estudiante cargado.',
        });
      }

      if (row.impacted_students !== row.total_students) {
        return reply.status(400).send({
          error: 'Para otorgar, el acuerdo debe tener impacto cargado en cada hijo.',
        });
      }
    }

    const result = await fastify.db.query(
      `UPDATE families SET status = $1::family_status,
        interview_date = CASE WHEN $3 THEN $4::timestamptz ELSE interview_date END
       WHERE id = $2 RETURNING *`,
      [data.status, id, data.interview_date !== undefined, data.interview_date ?? null]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
    }

    const endedAtColumn = await fastify.db.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agreements'
          AND column_name = 'ended_at'
      ) AS exists
    `);

    // Compatibilidad hacia atrás: en entornos sin la migración 012, evitar 500.
    if (endedAtColumn.rows[0]?.exists) {
      await fastify.db.query(
        `UPDATE agreements
         SET ended_at = CASE
           WHEN $1::text = 'suspendido' THEN COALESCE(ended_at, NOW())
           ELSE NULL
         END
         WHERE family_id = $2
           AND period_id = (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1)`,
        [data.status, id]
      );
    }

    return result.rows[0];
  });

  // Actualizar fecha de entrevista
  fastify.patch('/api/families/:id/interview', {
    preHandler: [fastify.requirePermission('canChangeStatus')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { interview_date } = z.object({
      interview_date: z.string().nullable(),
    }).parse(request.body);

    const result = await fastify.db.query(
      `UPDATE families SET interview_date = $1::timestamptz WHERE id = $2 RETURNING *`,
      [interview_date, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
    }

    return result.rows[0];
  });

  // Listar estudiantes de una familia
  fastify.get('/api/families/:id/students', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await fastify.db.query(
      'SELECT * FROM students WHERE family_id = $1 ORDER BY name', [id]
    );
    return result.rows;
  });

  // Ahorro mensual histórico de una familia
  fastify.get('/api/families/:id/monthly-savings', {
    preHandler: [fastify.requireCommittee],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { from, to, period_id } = request.query as {
      from?: string; to?: string; period_id?: string;
    };

    // Determinar rango de meses: por defecto, el período activo
    let fromDate: string;
    let toDate: string;

    if (from && to) {
      fromDate = `${from}-01`;
      toDate = `${to}-01`;
    } else {
      const periodResult = await fastify.db.query(`
        SELECT start_month, end_month, year FROM aid_periods
        WHERE id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      `, [period_id ?? null]);

      if (periodResult.rows.length === 0) {
        return reply.status(404).send({ error: 'No hay período activo' });
      }
      const p = periodResult.rows[0];
      fromDate = `${p.year}-${String(p.start_month).padStart(2, '0')}-01`;
      toDate = `${p.year}-${String(p.end_month).padStart(2, '0')}-01`;
    }

    const result = await fastify.db.query(`
      WITH months AS (
        SELECT generate_series($2::date, $3::date, '1 month')::date AS month_start
      ),
      month_schedules AS (
        SELECT DISTINCT ON (m.month_start)
          m.month_start, fs.id AS schedule_id, fs.name AS schedule_name
        FROM months m
        JOIN fee_schedules fs ON fs.effective_from <= m.month_start
        ORDER BY m.month_start, fs.effective_from DESC
      )
      SELECT
        ms.month_start,
        ms.schedule_name,
        s.id AS student_id,
        s.name AS student_name,
        s.level,
        fsr.tuition_amount,
        fsr.extras_amount,
        a.discount_percentage,
        ROUND(fsr.tuition_amount * a.discount_percentage / 100, 2) AS savings,
        ROUND(fsr.tuition_amount - fsr.tuition_amount * a.discount_percentage / 100 + fsr.extras_amount, 2) AS to_pay
      FROM month_schedules ms
      JOIN agreements a ON a.family_id = $1::int
        AND a.period_id = COALESCE($4::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      JOIN students s ON s.family_id = $1::int
      JOIN fee_schedule_rates fsr ON fsr.fee_schedule_id = ms.schedule_id AND fsr.level = s.level
      ORDER BY ms.month_start, s.name
    `, [id, fromDate, toDate, period_id ?? null]);

    // Agrupar por mes
    const monthsMap = new Map<string, {
      month: string;
      schedule_name: string;
      students: Array<{
        student_id: number;
        student_name: string;
        level: string;
        tuition_amount: number;
        extras_amount: number;
        discount_percentage: number;
        savings: number;
        to_pay: number;
      }>;
      total_savings: number;
      total_to_pay: number;
    }>();

    for (const row of result.rows) {
      const key = row.month_start.toISOString().slice(0, 7);
      if (!monthsMap.has(key)) {
        monthsMap.set(key, {
          month: key,
          schedule_name: row.schedule_name,
          students: [],
          total_savings: 0,
          total_to_pay: 0,
        });
      }
      const entry = monthsMap.get(key)!;
      const savings = Number(row.savings);
      const toPay = Number(row.to_pay);
      entry.students.push({
        student_id: row.student_id,
        student_name: row.student_name,
        level: row.level,
        tuition_amount: Number(row.tuition_amount),
        extras_amount: Number(row.extras_amount),
        discount_percentage: Number(row.discount_percentage),
        savings,
        to_pay: toPay,
      });
      entry.total_savings += savings;
      entry.total_to_pay += toPay;
    }

    return Array.from(monthsMap.values());
  });

  // Crear estudiante
  fastify.post('/api/families/:id/students', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = createStudentSchema.parse(request.body);
    const result = await fastify.db.query(
      `INSERT INTO students (family_id, name, level, grade, file_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, data.name, data.level, data.grade, data.file_number]
    );
    return result.rows[0];
  });

  // Actualizar estudiante
  fastify.put('/api/families/:familyId/students/:studentId', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request, reply) => {
    const { familyId, studentId } = request.params as { familyId: string; studentId: string };
    const data = updateStudentSchema.parse(request.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No hay campos para actualizar' });
    }

    values.push(studentId, familyId);
    const result = await fastify.db.query(
      `UPDATE students
       SET ${fields.join(', ')}
       WHERE id = $${idx++} AND family_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Estudiante no encontrado' });
    }

    return result.rows[0];
  });

  // Eliminar estudiante
  fastify.delete('/api/families/:familyId/students/:studentId', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request, reply) => {
    const { familyId, studentId } = request.params as { familyId: string; studentId: string };
    const result = await fastify.db.query(
      'DELETE FROM students WHERE id = $1 AND family_id = $2 RETURNING id',
      [studentId, familyId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Estudiante no encontrado' });
    }

    return { ok: true };
  });
}
