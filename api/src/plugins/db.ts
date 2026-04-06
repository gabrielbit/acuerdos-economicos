import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';

const { Pool } = pg;

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/acuerdos_economicos',
  });

  await pool.query('SELECT 1');
  fastify.log.info('Database connected');

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
