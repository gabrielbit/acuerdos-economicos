import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance | null = null;
let appPromise: Promise<FastifyInstance> | null = null;

async function getApp() {
  if (app) return app;
  if (!appPromise) {
    appPromise = buildApp().then(async (instance) => {
      await instance.ready();
      app = instance;
      return instance;
    }).catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fastify = await getApp();

    // Adaptar req/res de Vercel a Fastify.
    // Vercel ya parsea el body, así que reconstruimos el payload y normalizamos
    // los headers para que coincidan: sin body no debe ir content-type/content-length
    // (de lo contrario Fastify lanza 415 FST_ERR_CTP_INVALID_MEDIA_TYPE), y con body
    // forzamos application/json dejando que inject recalcule el content-length.
    const hasBody =
      req.body !== undefined &&
      req.body !== null &&
      !(typeof req.body === 'string' && req.body.length === 0);

    const headers = { ...(req.headers as Record<string, string>) };
    delete headers['content-length'];

    let payload: string | undefined;
    if (hasBody) {
      payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    } else {
      delete headers['content-type'];
      payload = undefined;
    }

    const response = await fastify.inject({
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD',
      url: req.url ?? '/',
      headers,
      payload,
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
