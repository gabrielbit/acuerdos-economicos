import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastify = await getApp();

    // Adaptar req/res de Vercel a Fastify
    const response = await fastify.inject({
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD',
      url: req.url ?? '/',
      headers: req.headers as Record<string, string>,
      payload: req.body ? JSON.stringify(req.body) : undefined,
    });

    res.status(response.statusCode);
    for (const [key, value] of Object.entries(response.headers)) {
      if (value) res.setHeader(key, value as string);
    }
    res.end(response.body);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
