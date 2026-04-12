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

  // Backward-compatible routes (agreement comments)
  fastify.get('/api/agreements/:id/comments', {
    preHandler: [fastify.requireAuth],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.entity_type = 'agreement' AND c.entity_id = $1
      ORDER BY c.created_at DESC
    `, [id]);
    return result.rows;
  });

  fastify.post('/api/agreements/:id/comments', {
    preHandler: [fastify.requirePermission('canComment')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { content } = createCommentSchema.parse(request.body);

    const result = await fastify.db.query(`
      INSERT INTO comments (entity_type, entity_id, user_id, content)
      VALUES ('agreement', $1, $2, $3)
      RETURNING *
    `, [id, request.user.userId, content]);

    const comment = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    return comment.rows[0];
  });
}
