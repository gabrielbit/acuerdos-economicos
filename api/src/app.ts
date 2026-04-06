import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import familyRoutes from './routes/families.js';
import agreementRoutes from './routes/agreements.js';
import budgetRoutes from './routes/budget.js';
import periodRoutes from './routes/periods.js';
import commentRoutes from './routes/comments.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes);
  await fastify.register(familyRoutes);
  await fastify.register(agreementRoutes);
  await fastify.register(budgetRoutes);
  await fastify.register(periodRoutes);
  await fastify.register(commentRoutes);

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  return fastify;
}
