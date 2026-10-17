import { logger } from './lib/logger';
import { prisma, connectWithRetry } from './db/prisma';

let running = true;

async function main(): Promise<void> {
  await connectWithRetry();
  logger.info('Outbox worker started');

  process.on('SIGTERM', () => {
    logger.info('Worker received SIGTERM, stopping after current batch...');
    running = false;
  });
  process.on('SIGINT', () => {
    logger.info('Worker received SIGINT, stopping after current batch...');
    running = false;
  });

  while (running) {
    // Worker implementation will be added in Task 6
    await new Promise((r) => setTimeout(r, 2000));
  }

  await prisma.$disconnect();
  logger.info('Worker stopped');
}

main().catch((err: unknown) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
