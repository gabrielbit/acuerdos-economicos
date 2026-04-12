import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function invitationRoutes(fastify: FastifyInstance) {
  // Generar invitación para una familia (comisión)
  fastify.post('/api/families/:id/invitation', {
    preHandler: [fastify.requirePermission('canManageFamilies')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verificar que la familia existe
    const family = await fastify.db.query('SELECT id, name FROM families WHERE id = $1', [id]);
    if (family.rows.length === 0) {
      return reply.status(404).send({ error: 'Familia no encontrada' });
    }

    // Invalidar invitaciones anteriores no usadas
    await fastify.db.query(
      "UPDATE invitations SET expires_at = NOW() WHERE family_id = $1 AND use_count = 0 AND expires_at > NOW()",
      [id]
    );

    // Crear nueva invitación (válida por 30 días)
    const token = randomBytes(32).toString('hex');
    const result = await fastify.db.query(
      `INSERT INTO invitations (family_id, token, expires_at, max_uses)
       VALUES ($1, $2, NOW() + INTERVAL '30 days', 2)
       RETURNING *`,
      [id, token]
    );

    // Auto-transición: solicitud → formulario_enviado
    await fastify.db.query(
      `UPDATE families SET status = 'formulario_enviado'::family_status WHERE id = $1 AND status::text = 'solicitud'`,
      [id]
    );

    return {
      ...result.rows[0],
      family_name: family.rows[0].name,
    };
  });

  // Ver invitación activa de una familia (comisión)
  fastify.get('/api/families/:id/invitation', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { id } = request.params as { id: string };

    const result = await fastify.db.query(
      `SELECT i.*, f.name as family_name
       FROM invitations i
       JOIN families f ON f.id = i.family_id
       WHERE i.family_id = $1 AND i.expires_at > NOW() AND i.use_count < i.max_uses
       ORDER BY i.created_at DESC LIMIT 1`,
      [id]
    );

    return result.rows[0] ?? null;
  });

  // Validar token (público)
  fastify.get('/api/invitations/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const result = await fastify.db.query(
      `SELECT i.*, f.name as family_name
       FROM invitations i
       JOIN families f ON f.id = i.family_id
       WHERE i.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Invitación no encontrada' });
    }

    const inv = result.rows[0];

    if (new Date(inv.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Esta invitación expiró' });
    }

    if (inv.use_count >= inv.max_uses) {
      return reply.status(410).send({ error: 'Esta invitación ya fue utilizada' });
    }

    return {
      family_name: inv.family_name,
      family_id: inv.family_id,
      valid: true,
    };
  });

  // Registrar usuario desde invitación (público)
  fastify.post('/api/invitations/:token/register', async (request, reply) => {
    const { token } = request.params as { token: string };
    const data = registerSchema.parse(request.body);

    const client = await fastify.db.connect();
    try {
      await client.query('BEGIN');

      // Validar invitación
      const invResult = await client.query(
        `SELECT i.*, f.name as family_name
         FROM invitations i
         JOIN families f ON f.id = i.family_id
         WHERE i.token = $1 FOR UPDATE`,
        [token]
      );

      if (invResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Invitación no encontrada' });
      }

      const inv = invResult.rows[0];

      if (new Date(inv.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return reply.status(410).send({ error: 'Esta invitación expiró' });
      }

      if (inv.use_count >= inv.max_uses) {
        await client.query('ROLLBACK');
        return reply.status(410).send({ error: 'Esta invitación ya fue utilizada' });
      }

      // Verificar email no duplicado
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [data.email]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Ya existe un usuario con ese email' });
      }

      // Crear usuario
      const hash = await bcrypt.hash(data.password, 10);
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role,
          can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment)
         VALUES ($1, $2, $3, 'family', false, false, false, false, false)
         RETURNING id, email, name, role`,
        [data.email, hash, data.name]
      );
      const user = userResult.rows[0];

      // Linkear usuario a familia
      await client.query(
        'INSERT INTO family_users (family_id, user_id) VALUES ($1, $2)',
        [inv.family_id, user.id]
      );

      // Incrementar uso de invitación
      await client.query(
        'UPDATE invitations SET use_count = use_count + 1 WHERE id = $1',
        [inv.id]
      );

      // Actualizar email/parent_names de la familia si están vacíos
      await client.query(
        `UPDATE families SET
          email = COALESCE(NULLIF(email, ''), $1),
          parent_names = COALESCE(NULLIF(parent_names, ''), $2)
         WHERE id = $3`,
        [data.email, data.name, inv.family_id]
      );

      await client.query('COMMIT');

      // Generar token JWT
      const jwtToken = fastify.jwt.sign({
        userId: user.id,
        role: 'family' as const,
        familyId: inv.family_id,
        permissions: {
          canManageFamilies: false,
          canManageAgreements: false,
          canChangeStatus: false,
          canManageUsers: false,
          canComment: false,
        },
      });

      return {
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          familyId: inv.family_id,
          permissions: {
            canManageFamilies: false,
            canManageAgreements: false,
            canChangeStatus: false,
            canManageUsers: false,
            canComment: false,
          },
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
