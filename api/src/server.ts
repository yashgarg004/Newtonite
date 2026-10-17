import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma, connectWithRetry } from './db/prisma';

async function main(): Promise<void> {
  await connectWithRetry();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API server started');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down...');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((err: unknown) => {
  logger.fatal(err, 'Failed to start');
  process.exit(1);
});
