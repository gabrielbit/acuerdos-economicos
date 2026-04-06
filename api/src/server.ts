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

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
});

await fastify.register(dbPlugin);
await fastify.register(authPlugin);

// Rutas
await fastify.register(authRoutes);
await fastify.register(familyRoutes);
await fastify.register(agreementRoutes);
await fastify.register(budgetRoutes);
await fastify.register(periodRoutes);
await fastify.register(commentRoutes);

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
