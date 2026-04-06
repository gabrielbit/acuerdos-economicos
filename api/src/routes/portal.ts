import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

async function requireFamily(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'family' || !request.user.familyId) {
      return reply.status(403).send({ error: 'Acceso restringido a familias' });
    }
  } catch {
    reply.status(401).send({ error: 'No autorizado' });
  }
}

const requestFormSchema = z.object({
  requested_discount: z.number().min(0).max(100).optional(),
  is_renewal: z.boolean().default(false),
  reason: z.string().optional(),
  // Datos de contacto
  address: z.string().optional(),
  locality: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  // Grupo familiar adultos
  family_members: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    occupation: z.string().optional(),
    age: z.coerce.number().optional(),
  })).optional(),
  // Hijos (incluye los de otras escuelas)
  children: z.array(z.object({
    name: z.string(),
    school: z.string().optional(),
    grade: z.string(),
    level: z.string().optional(),
    has_current_aid: z.boolean().default(false),
    requests_aid: z.boolean().default(false),
    observations: z.string().optional(),
  })).optional(),
  // Vivienda
  housing_type: z.string().optional(),
  housing_surface: z.string().optional(),
  housing_rooms: z.number().optional(),
  housing_bedrooms: z.number().optional(),
  // Status
  status: z.enum(['borrador', 'enviada']).default('borrador'),
});

export default async function portalRoutes(fastify: FastifyInstance) {
  // Datos de mi familia
  fastify.get('/api/portal/family', {
    preHandler: [requireFamily],
  }, async (request) => {
    const familyId = request.user.familyId;

    const familyResult = await fastify.db.query(
      'SELECT * FROM families WHERE id = $1', [familyId]
    );
    const studentsResult = await fastify.db.query(
      'SELECT * FROM students WHERE family_id = $1 ORDER BY name', [familyId]
    );

    return {
      ...familyResult.rows[0],
      students: studentsResult.rows,
    };
  });

  // Mis acuerdos
  fastify.get('/api/portal/agreements', {
    preHandler: [requireFamily],
  }, async (request) => {
    const familyId = request.user.familyId;

    const result = await fastify.db.query(`
      SELECT a.*, p.name as period_name,
        json_agg(json_build_object(
          'id', ast.id,
          'student_name', s.name,
          'level', ast.level,
          'base_tuition', ast.base_tuition,
          'extras', ast.extras,
          'discount_percentage', ast.discount_percentage,
          'discount_amount', ast.discount_amount,
          'amount_to_pay', ast.amount_to_pay
        )) FILTER (WHERE ast.id IS NOT NULL) AS students
      FROM agreements a
      JOIN aid_periods p ON p.id = a.period_id
      LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      LEFT JOIN students s ON s.id = ast.student_id
      WHERE a.family_id = $1
      GROUP BY a.id, p.name
      ORDER BY a.created_at DESC
    `, [familyId]);

    return result.rows;
  });

  // Mi solicitud actual (del período activo)
  fastify.get('/api/portal/request', {
    preHandler: [requireFamily],
  }, async (request) => {
    const familyId = request.user.familyId;

    const result = await fastify.db.query(`
      SELECT ar.*, u.name as submitted_by_name
      FROM aid_requests ar
      JOIN aid_periods p ON p.id = ar.period_id AND p.is_active = true
      LEFT JOIN users u ON u.id = ar.submitted_by
      WHERE ar.family_id = $1
      ORDER BY ar.created_at DESC LIMIT 1
    `, [familyId]);

    return result.rows[0] ?? null;
  });

  // Crear/enviar solicitud
  fastify.post('/api/portal/request', {
    preHandler: [requireFamily],
  }, async (request, reply) => {
    const familyId = request.user.familyId;
    const data = requestFormSchema.parse(request.body);

    // Verificar período activo
    const periodResult = await fastify.db.query(
      'SELECT id FROM aid_periods WHERE is_active = true LIMIT 1'
    );
    if (periodResult.rows.length === 0) {
      return reply.status(400).send({ error: 'No hay un período activo' });
    }
    const periodId = periodResult.rows[0].id;

    // Verificar que no exista solicitud enviada
    const existing = await fastify.db.query(
      "SELECT id, status FROM aid_requests WHERE family_id = $1 AND period_id = $2 AND status = 'enviada'",
      [familyId, periodId]
    );
    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'Ya se envió una solicitud para este período' });
    }

    // Buscar borrador existente
    const draft = await fastify.db.query(
      "SELECT id FROM aid_requests WHERE family_id = $1 AND period_id = $2 AND status = 'borrador'",
      [familyId, periodId]
    );

    const housingType = data.housing_type || null;
    const isSubmitting = data.status === 'enviada';
    const formSnapshot = isSubmitting ? data : null;

    if (draft.rows.length > 0) {
      // Actualizar borrador
      const result = await fastify.db.query(
        `UPDATE aid_requests SET
          requested_discount = $1, is_renewal = $2, reason = $3,
          housing_type = $4::housing_type, housing_surface = $5, housing_rooms = $6, housing_bedrooms = $7,
          status = $8, additional_info = $9,
          submitted_by = $10, submitted_at = $11,
          form_snapshot = COALESCE($12, form_snapshot),
          updated_at = NOW()
        WHERE id = $13 RETURNING *`,
        [
          data.requested_discount, data.is_renewal, data.reason,
          housingType, data.housing_surface, data.housing_rooms, data.housing_bedrooms,
          data.status,
          JSON.stringify({ family_members: data.family_members, children: data.children }),
          isSubmitting ? request.user.userId : null,
          isSubmitting ? new Date() : null,
          formSnapshot ? JSON.stringify(formSnapshot) : null,
          draft.rows[0].id,
        ]
      );

      // Actualizar datos de contacto de la familia
      if (data.address || data.locality || data.postal_code || data.phone) {
        await fastify.db.query(
          `UPDATE families SET
            address = COALESCE($1, address),
            locality = COALESCE($2, locality),
            postal_code = COALESCE($3, postal_code),
            phone = COALESCE($4, phone)
          WHERE id = $5`,
          [data.address, data.locality, data.postal_code, data.phone, familyId]
        );
      }

      return result.rows[0];
    }

    // Crear nueva solicitud
    const result = await fastify.db.query(
      `INSERT INTO aid_requests (
        family_id, period_id, status, requested_discount, is_renewal, reason,
        housing_type, housing_surface, housing_rooms, housing_bedrooms,
        additional_info, submitted_by, submitted_at, form_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        familyId, periodId, data.status,
        data.requested_discount, data.is_renewal, data.reason,
        data.housing_type, data.housing_surface, data.housing_rooms, data.housing_bedrooms,
        JSON.stringify({ family_members: data.family_members, children: data.children }),
        isSubmitting ? request.user.userId : null,
        isSubmitting ? new Date() : null,
        formSnapshot ? JSON.stringify(formSnapshot) : null,
      ]
    );

    // Actualizar datos de contacto
    if (data.address || data.locality || data.postal_code || data.phone) {
      await fastify.db.query(
        `UPDATE families SET
          address = COALESCE($1, address),
          locality = COALESCE($2, locality),
          postal_code = COALESCE($3, postal_code),
          phone = COALESCE($4, phone)
        WHERE id = $5`,
        [data.address, data.locality, data.postal_code, data.phone, familyId]
      );
    }

    return result.rows[0];
  });
}
