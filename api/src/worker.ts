import { logger } from './lib/logger';
import { prisma, connectWithRetry } from './db/prisma';
import { runWorker } from './outbox/worker';

let running = true;

async function main(): Promise<void> {
  await connectWithRetry();
  logger.info('Outbox worker process started');

  const onShutdown = (signal: string) => {
    logger.info({ signal }, 'Worker received shutdown signal, finishing in-flight jobs...');
    running = false;
  };

  process.on('SIGTERM', () => onShutdown('SIGTERM'));
  process.on('SIGINT', () => onShutdown('SIGINT'));

  try {
    await runWorker(() => !running);
  } catch (err) {
    logger.error({ err }, 'Worker loop encountered unrecoverable error');
  } finally {
    await prisma.$disconnect();
    logger.info('Worker stopped and database disconnected');
  }
}

main().catch((err: unknown) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
