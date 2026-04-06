import type { VercelRequest, VercelResponse } from '@vercel/node';
import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../src/app.js';

let proxy: ReturnType<typeof awsLambdaFastify> | null = null;

async function getProxy() {
  if (!proxy) {
    const app = await buildApp();
    await app.ready();
    proxy = awsLambdaFastify(app);
  }
  return proxy;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const p = await getProxy();
  // @ts-expect-error Vercel req/res son compatibles con Lambda
  return p({ ...req, requestContext: {} }, res);
}
