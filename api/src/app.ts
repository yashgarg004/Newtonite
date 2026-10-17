import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler } from './errors/error-handler';
import { prisma } from './db/prisma';

const app = express();

// Request ID
app.use((req, _res, next) => {
  req.id = randomUUID();
  next();
});

// Logging
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

// Body parsing
app.use(express.json({ limit: '100kb' }));

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Routes will be added here in subsequent tasks

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Error handler (must be last)
app.use(errorHandler);

export { app };