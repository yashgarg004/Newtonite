import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler } from './errors/error-handler';
import { prisma } from './db/prisma';
import { authRoutes } from './auth/auth.routes';
import { itemRoutes } from './items/items.routes';
import { dashboardRoutes } from './dashboard/dashboard.routes'; 

const app = express();

app.use((req, _res, next) => {
  req.id = randomUUID();
  next();
});

app.use(
  pinoHttp({
    logger,
    quietReqLogger: true,
    genReqId: (req) => {
      const existing = (req as unknown as { id?: string }).id;
      return existing ?? randomUUID();
    },
  }),
);

app.use(express.json({ limit: '100kb' }));

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/dashboard', dashboardRoutes); 

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

app.use(errorHandler);

export { app };