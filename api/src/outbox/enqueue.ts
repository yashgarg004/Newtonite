import { Tx } from '../db/transaction';

export async function enqueueJob(
  tx: Tx,
  type: string,
  payload: Record<string, unknown>
) {
  await tx.outbox_jobs.create({
    data: {
      type,
      payload: payload as any,
      status: 'pending',
      run_at: new Date(),
    },
  });
}