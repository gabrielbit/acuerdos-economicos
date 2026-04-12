import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createFamilySchema = z.object({
  name: z.string().min(1),
  parent_names: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const createStudentSchema = z.object({
  name: z.string().min(1),
  level: z.enum(['jardin', 'primaria', 'secundaria', '12vo']),
  grade: z.string().min(1),
  file_number: z.string().optional(),
});

export default async function familyRoutes(fastify: FastifyInstance) {
  // Listar familias con datos del acuerdo del período activo
  fastify.get('/api/families', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };

    const result = await fastify.db.query(`
      SELECT
        f.id, f.name, f.parent_names, f.email, f.phone, f.user_id, f.created_at,
        f.status::text AS status, f.interview_date,
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
      SELECT f.id, f.name, f.parent_names, f.interview_date, f.status::text AS status
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
      `INSERT INTO families (name, parent_names, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.parent_names, data.email, data.phone]
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

    const result = await fastify.db.query(
      `UPDATE families SET status = $1::family_status,
        interview_date = CASE WHEN $3 THEN $4::timestamptz ELSE interview_date END
       WHERE id = $2 RETURNING *`,
      [data.status, id, data.interview_date !== undefined, data.interview_date ?? null]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
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
}
