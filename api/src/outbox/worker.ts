import { prisma } from '../db/prisma';
import { logger } from '../lib/logger';
import { handlers } from './handlers';

const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 1000;
const REAP_INTERVAL_MS = 30000;

export interface OutboxJob {
  id: bigint;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export async function claimBatch(): Promise<OutboxJob[]> {
  return prisma.$queryRaw<OutboxJob[]>`
    UPDATE outbox_jobs
    SET status = 'processing'::job_status, locked_at = now(), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM outbox_jobs
      WHERE status = 'pending'::job_status AND run_at <= now()
      ORDER BY run_at
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts, max_attempts
  `;
}

async function processJob(job: OutboxJob): Promise<void> {
  const handler = handlers[job.type];
  if (!handler) {
    throw new Error(`Unknown job type: ${job.type}`);
  }

  await prisma.$transaction(async (tx) => {
    await handler(tx, job.payload);
    await tx.outbox_jobs.update({
      where: { id: job.id },
      data: { status: 'done', processed_at: new Date() },
    });
  });
}

export async function handleFailure(job: OutboxJob, err: unknown): Promise<void> {
  const errorMsg = String(err).slice(0, 500);
  await prisma.$executeRaw`
    UPDATE outbox_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed'::job_status ELSE 'pending'::job_status END,
        run_at = now() + (LEAST(power(2, attempts), 300) * interval '1 second'),
        last_error = ${errorMsg},
        locked_at = NULL
    WHERE id = ${job.id}::bigint
  `;
}

export async function reapStuckJobs(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE outbox_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed'::job_status ELSE 'pending'::job_status END,
        locked_at = NULL,
        last_error = COALESCE(last_error, '') || ' [reaped]'
    WHERE status = 'processing'::job_status
      AND locked_at < now() - interval '5 minutes'
  `;
}

export async function runWorker(stopSignal: () => boolean): Promise<void> {
  logger.info('Outbox worker loop started');
  let lastReap = Date.now();

  while (!stopSignal()) {
    try {
      if (Date.now() - lastReap > REAP_INTERVAL_MS) {
        await reapStuckJobs();
        lastReap = Date.now();
      }

      const jobs = await claimBatch();

      for (const job of jobs) {
        if (stopSignal()) break;
        try {
          await processJob(job);
        } catch (err) {
          logger.error({ err, jobId: job.id.toString() }, 'Job failed');
          await handleFailure(job, err);
        }
      }

      if (jobs.length === 0) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (err) {
      logger.error({ err }, 'Worker loop error');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  logger.info('Outbox worker loop stopped');
}