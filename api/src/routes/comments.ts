import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const entityTypes = ['family', 'agreement'] as const;

const createCommentSchema = z.object({
  content: z.string().min(1),
});

const querySchema = z.object({
  entity_type: z.enum(entityTypes),
  entity_id: z.coerce.number().int().positive(),
});

export default async function commentRoutes(fastify: FastifyInstance) {
  // Listar comentarios de una entidad
  fastify.get('/api/comments', {
    preHandler: [fastify.requireAuth],
  }, async (request) => {
    const { entity_type, entity_id } = querySchema.parse(request.query);
    if (entity_type === 'family') {
      const result = await fastify.db.query(`
        SELECT c.*, u.name as user_name
        FROM comments c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN agreements a ON c.entity_type = 'agreement' AND a.id = c.entity_id
        WHERE (c.entity_type = 'family' AND c.entity_id = $1)
          OR (c.entity_type = 'agreement' AND a.family_id = $1)
        ORDER BY c.created_at DESC
      `, [entity_id]);
      return result.rows;
    }

    const result = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.entity_type = $1 AND c.entity_id = $2
      ORDER BY c.created_at DESC
    `, [entity_type, entity_id]);
    return result.rows;
  });

  // Agregar comentario a una entidad
  fastify.post('/api/comments', {
    preHandler: [fastify.requirePermission('canComment')],
  }, async (request) => {
    const { entity_type, entity_id } = querySchema.parse(request.query);
    const { content } = createCommentSchema.parse(request.body);

    const result = await fastify.db.query(`
      INSERT INTO comments (entity_type, entity_id, user_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [entity_type, entity_id, request.user.userId, content]);

    const comment = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    return comment.rows[0];
  });

  // Últimas notas globales agrupadas por familia (para dashboard)
  fastify.get('/api/comments/recent', {
    preHandler: [fastify.requireCommittee],
  }, async () => {
    const result = await fastify.db.query(`
      SELECT c.id, c.content, c.created_at, c.entity_type,
        u.name AS user_name,
        COALESCE(f.id, fa.id) AS family_id,
        COALESCE(f.name, fa.name) AS family_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN families f ON c.entity_type = 'family' AND f.id = c.entity_id
      LEFT JOIN agreements a ON c.entity_type = 'agreement' AND a.id = c.entity_id
      LEFT JOIN families fa ON a.family_id = fa.id
      WHERE COALESCE(f.id, fa.id) IN (
        SELECT DISTINCT sub_fam_id FROM (
          SELECT COALESCE(f2.id, fa2.id) AS sub_fam_id,
            MAX(c2.created_at) AS last_note
          FROM comments c2
          LEFT JOIN families f2 ON c2.entity_type = 'family' AND f2.id = c2.entity_id
          LEFT JOIN agreements a2 ON c2.entity_type = 'agreement' AND a2.id = c2.entity_id
          LEFT JOIN families fa2 ON a2.family_id = fa2.id
          GROUP BY COALESCE(f2.id, fa2.id)
          ORDER BY last_note DESC
          LIMIT 5
        ) recent_families
      )
      ORDER BY c.created_at DESC
    `);
    return result.rows;
  });

  // Backward-compatible routes: agreement comments now resolve to family comments.
  fastify.get('/api/agreements/:id/comments', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agreement = await fastify.db.query(
      `SELECT family_id FROM agreements WHERE id = $1`,
      [id]
    );
    if (agreement.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    const result = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.entity_type = 'family' AND c.entity_id = $1
      ORDER BY c.created_at DESC
    `, [agreement.rows[0].family_id]);
    return result.rows;
  });

  fastify.post('/api/agreements/:id/comments', {
    preHandler: [fastify.requirePermission('canComment')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = createCommentSchema.parse(request.body);
    const agreement = await fastify.db.query(
      `SELECT family_id FROM agreements WHERE id = $1`,
      [id]
    );
    if (agreement.rows.length === 0) {
      return reply.status(404).send({ error: 'Acuerdo no encontrado' });
    }

    const result = await fastify.db.query(`
      INSERT INTO comments (entity_type, entity_id, user_id, content)
      VALUES ('family', $1, $2, $3)
      RETURNING *
    `, [agreement.rows[0].family_id, request.user.userId, content]);

    const comment = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    return comment.rows[0];
  });
}
