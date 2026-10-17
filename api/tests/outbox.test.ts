import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db/prisma';
import { runWorker, reapStuckJobs } from '../src/outbox/worker';
import { createUserInTeam, createTestItem } from './helpers/fixtures';

async function insertJob(type: string, payload: any, status = 'pending'): Promise<bigint> {
  const result = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO outbox_jobs (type, payload, status, run_at)
    VALUES (${type}, ${JSON.stringify(payload)}::jsonb, ${status}::job_status, now())
    RETURNING id
  `;
  return result[0].id;
}

describe('Outbox worker', () => {
  it('a job handled twice creates one notification', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id);
    const payload = { assigneeId: user.id, itemId: item.id, version: 1 };

    await insertJob('notify_new_assignee', payload);
    await insertJob('notify_new_assignee', payload);

    let stopWorker = false;
    const workerP = runWorker(() => stopWorker);

    await new Promise((r) => setTimeout(r, 2500));
    stopWorker = true;
    await workerP;

    const count = await prisma.notifications.count({
      where: { item_id: item.id, user_id: user.id },
    });
    expect(count).toBe(1);
  });

  it('a failing handler increments attempts, moves run_at, and ends as failed after max_attempts', async () => {
    const jobId = await insertJob('unknown_type_xyz', {});

    const runOnce = async () => {
      await prisma.$executeRaw`UPDATE outbox_jobs SET run_at = now() WHERE id = ${jobId}::bigint`;
      let stop = false;
      const p = runWorker(() => stop);
      await new Promise((r) => setTimeout(r, 1500));
      stop = true;
      await p;
    };

    // max_attempts is 5, so it should fail on the 5th attempt
    for (let i = 0; i < 5; i++) {
      await runOnce();
    }

    const finalJob = await prisma.$queryRaw<{ attempts: number; status: string }[]>`
      SELECT attempts, status FROM outbox_jobs WHERE id = ${jobId}::bigint
    `;
    expect(finalJob[0].attempts).toBe(5);
    expect(finalJob[0].status).toBe('failed');
  });

  it('a stale processing job is reset by the reaper', async () => {
    const jobId = await insertJob('notify_new_assignee', {}, 'processing');
    
    await prisma.$executeRaw`
      UPDATE outbox_jobs SET locked_at = now() - interval '10 minutes' WHERE id = ${jobId}::bigint
    `;

    await reapStuckJobs();

    const job = await prisma.$queryRaw<{ status: string; locked_at: Date | null }[]>`
      SELECT status, locked_at FROM outbox_jobs WHERE id = ${jobId}::bigint
    `;
    expect(job[0].status).toBe('pending');
    expect(job[0].locked_at).toBeNull();
  });

  it('two workers running at the same time handle each of 20 jobs exactly once', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id);

    const jobIds: bigint[] = [];
    for (let i = 0; i < 20; i++) {
      const payload = { assigneeId: user.id, itemId: item.id, version: i + 100 };
      const id = await insertJob('notify_new_assignee', payload);
      jobIds.push(id);
    }

    let stop1 = false;
    let stop2 = false;
    const p1 = runWorker(() => stop1);
    const p2 = runWorker(() => stop2);

    await new Promise((r) => setTimeout(r, 3000));
    stop1 = true;
    stop2 = true;
    await Promise.all([p1, p2]);

    const doneCount = await prisma.outbox_jobs.count({
      where: { id: { in: jobIds as any[] }, status: 'done' },
    });
    expect(doneCount).toBe(20);

    const notifCount = await prisma.notifications.count({
      where: { item_id: item.id, user_id: user.id },
    });
    expect(notifCount).toBe(20);
  });
});