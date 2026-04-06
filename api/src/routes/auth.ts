import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const result = await fastify.db.query(
      'SELECT id, email, name, password_hash, role FROM users WHERE email = $1',
      [body.email]
    );

    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    // Si es familia, buscar su family_id
    let familyId: number | null = null;
    if (user.role === 'family') {
      const familyResult = await fastify.db.query(
        'SELECT id FROM families WHERE user_id = $1',
        [user.id]
      );
      familyId = familyResult.rows[0]?.id ?? null;
    }

    const token = fastify.jwt.sign({
      userId: user.id,
      role: user.role,
      familyId,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        familyId,
      },
    };
  });

  fastify.get('/api/auth/me', {
    preHandler: [fastify.requireAuth],
  }, async (request) => {
    const result = await fastify.db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [request.user.userId]
    );
    return result.rows[0];
  });
}
