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
import feeScheduleRoutes from './routes/fee-schedules.js';
import settingsRoutes from './routes/settings.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
  });

  // El adaptador de Fastify en Vercel puede reenviar requests sin cuerpo
  // (p.ej. DELETE) con un content-type que Fastify no sabe parsear, lo que
  // dispara FST_ERR_CTP_INVALID_MEDIA_TYPE (415). Registramos un parser
  // catch-all tolerante a cuerpos vacíos: el parseo de application/json sigue
  // usando el parser nativo (este solo aplica cuando no hay parser específico).
  fastify.addContentTypeParser('*', (_request, payload, done) => {
    let data = '';
    payload.on('data', (chunk) => {
      data += chunk;
    });
    payload.on('end', () => {
      if (!data) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(data));
      } catch {
        done(null, data);
      }
    });
    payload.on('error', done);
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
  await fastify.register(feeScheduleRoutes);
  await fastify.register(settingsRoutes);

  fastify.get('/api/health', async () => {
    await fastify.db.query('SELECT 1');

    return { status: 'ok', database: 'ok' };
  });

  return fastify;
}
