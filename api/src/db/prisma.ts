import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ target: e.target, message: e.message }, 'Prisma error');
});

export async function connectWithRetry(maxRetries = 15, intervalMs = 2000): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await prisma.$connect();
      logger.info('Database connected');
      return;
    } catch (err) {
      logger.warn({ attempt: i, maxRetries }, 'Database connection failed, retrying...');
      if (i === maxRetries) {
        logger.error('Database connection failed after all retries');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
