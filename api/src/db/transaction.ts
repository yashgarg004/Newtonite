import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type Tx = Prisma.TransactionClient;

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const retryable =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034';
      if (!retryable || i >= attempts) throw e;
    }
  }
}

export function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withRetry(() =>
    prisma.$transaction(fn, { maxWait: 5000, timeout: 10000 }),
  );
}
