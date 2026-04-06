import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  can_manage_families: z.boolean().default(true),
  can_manage_agreements: z.boolean().default(true),
  can_change_status: z.boolean().default(true),
  can_manage_users: z.boolean().default(false),
  can_comment: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  can_manage_families: z.boolean().optional(),
  can_manage_agreements: z.boolean().optional(),
  can_change_status: z.boolean().optional(),
  can_manage_users: z.boolean().optional(),
  can_comment: z.boolean().optional(),
});

export default async function userRoutes(fastify: FastifyInstance) {
  // Listar usuarios comisión
  fastify.get('/api/users', {
    preHandler: [fastify.requirePermission('canManageUsers')],
  }, async () => {
    const result = await fastify.db.query(
      `SELECT id, email, name, role, created_at,
        can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment
       FROM users WHERE role = 'committee'
       ORDER BY name`
    );
    return result.rows;
  });

  // Crear usuario
  fastify.post('/api/users', {
    preHandler: [fastify.requirePermission('canManageUsers')],
  }, async (request, reply) => {
    const data = createUserSchema.parse(request.body);

    const existing = await fastify.db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'Ya existe un usuario con ese email' });
    }

    const hash = await bcrypt.hash(data.password, 10);
    const result = await fastify.db.query(
      `INSERT INTO users (email, name, password_hash, role, can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment)
       VALUES ($1, $2, $3, 'committee', $4, $5, $6, $7, $8)
       RETURNING id, email, name, role, created_at, can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment`,
      [data.email, data.name, hash, data.can_manage_families, data.can_manage_agreements, data.can_change_status, data.can_manage_users, data.can_comment]
    );
    return result.rows[0];
  });

  // Actualizar usuario
  fastify.put('/api/users/:id', {
    preHandler: [fastify.requirePermission('canManageUsers')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateUserSchema.parse(request.body);

    // No puede quitarse a sí mismo canManageUsers
    if (Number(id) === request.user.userId && data.can_manage_users === false) {
      return reply.status(400).send({ error: 'No podés quitarte el permiso de administrar usuarios' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.password !== undefined) {
      const hash = await bcrypt.hash(data.password, 10);
      fields.push(`password_hash = $${idx++}`); values.push(hash);
    }
    if (data.can_manage_families !== undefined) { fields.push(`can_manage_families = $${idx++}`); values.push(data.can_manage_families); }
    if (data.can_manage_agreements !== undefined) { fields.push(`can_manage_agreements = $${idx++}`); values.push(data.can_manage_agreements); }
    if (data.can_change_status !== undefined) { fields.push(`can_change_status = $${idx++}`); values.push(data.can_change_status); }
    if (data.can_manage_users !== undefined) { fields.push(`can_manage_users = $${idx++}`); values.push(data.can_manage_users); }
    if (data.can_comment !== undefined) { fields.push(`can_comment = $${idx++}`); values.push(data.can_comment); }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'No hay campos para actualizar' });
    }

    values.push(id);
    const result = await fastify.db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} AND role = 'committee'
       RETURNING id, email, name, role, created_at, can_manage_families, can_manage_agreements, can_change_status, can_manage_users, can_comment`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }
    return result.rows[0];
  });

  // Eliminar usuario
  fastify.delete('/api/users/:id', {
    preHandler: [fastify.requirePermission('canManageUsers')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (Number(id) === request.user.userId) {
      return reply.status(400).send({ error: 'No podés eliminarte a vos mismo' });
    }

    const result = await fastify.db.query(
      "DELETE FROM users WHERE id = $1 AND role = 'committee' RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }
    return { ok: true };
  });
}
