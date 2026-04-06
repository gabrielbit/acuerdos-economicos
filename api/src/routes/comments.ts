import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createCommentSchema = z.object({
  content: z.string().min(1),
});

export default async function commentRoutes(fastify: FastifyInstance) {
  // Listar comentarios de un acuerdo (último primero)
  fastify.get('/api/agreements/:id/comments', {
    preHandler: [fastify.requireAuth],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM agreement_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.agreement_id = $1
      ORDER BY c.created_at DESC
    `, [id]);
    return result.rows;
  });

  // Agregar comentario
  fastify.post('/api/agreements/:id/comments', {
    preHandler: [fastify.requirePermission('canComment')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { content } = createCommentSchema.parse(request.body);

    const result = await fastify.db.query(`
      INSERT INTO agreement_comments (agreement_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, request.user.userId, content]);

    // Traer con nombre de usuario
    const comment = await fastify.db.query(`
      SELECT c.*, u.name as user_name
      FROM agreement_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    return comment.rows[0];
  });
}
