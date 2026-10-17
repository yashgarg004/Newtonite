import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/db/prisma';

beforeEach(async () => {
  await prisma.$executeRaw`
    TRUNCATE
      users,
      teams,
      memberships,
      work_items,
      comments,
      activity_events,
      idempotency_keys,
      outbox_jobs,
      notifications
    RESTART IDENTITY CASCADE
  `;
});

afterAll(async () => {
  await prisma.$disconnect();
});
