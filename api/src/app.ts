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
import userRoutes from './routes/users.js';
import invitationRoutes from './routes/invitations.js';
import portalRoutes from './routes/portal.js';
import requestRoutes from './routes/requests.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
  });

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:5173'];

  await fastify.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes);
  await fastify.register(familyRoutes);
  await fastify.register(agreementRoutes);
  await fastify.register(budgetRoutes);
  await fastify.register(periodRoutes);
  await fastify.register(commentRoutes);
  await fastify.register(userRoutes);
  await fastify.register(invitationRoutes);
  await fastify.register(portalRoutes);
  await fastify.register(requestRoutes);

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  return fastify;
}
