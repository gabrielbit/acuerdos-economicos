import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { UserPermissions } from '../plugins/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function buildPermissions(user: Record<string, unknown>): UserPermissions {
  return {
    canManageFamilies: user.can_manage_families as boolean,
    canManageAgreements: user.can_manage_agreements as boolean,
    canChangeStatus: user.can_change_status as boolean,
    canManageUsers: user.can_manage_users as boolean,
    canComment: user.can_comment as boolean,
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const result = await fastify.db.query(
      `SELECT id, email, name, password_hash, role,
        can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment
       FROM users WHERE email = $1`,
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

    let familyId: number | null = null;
    if (user.role === 'family') {
      const familyResult = await fastify.db.query(
        'SELECT family_id FROM family_users WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      familyId = familyResult.rows[0]?.family_id ?? null;
    }

    const permissions = buildPermissions(user);

    const token = fastify.jwt.sign({
      userId: user.id,
      role: user.role,
      familyId,
      permissions,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        familyId,
        permissions,
      },
    };
  });

  fastify.get('/api/auth/me', {
    preHandler: [fastify.requireAuth],
  }, async (request) => {
    const result = await fastify.db.query(
      `SELECT id, email, name, role,
        can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment
       FROM users WHERE id = $1`,
      [request.user.userId]
    );
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      familyId: request.user.familyId,
      permissions: buildPermissions(user),
    };
  });
}
