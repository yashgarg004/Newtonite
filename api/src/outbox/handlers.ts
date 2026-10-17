import { Tx } from '../db/transaction';

export async function notifyNewAssignee(
  tx: Tx,
  payload: Record<string, unknown>,
): Promise<void> {
  const p = payload as { assigneeId: string; itemId: string; version: number };
  const dedupeKey = `assigned:${p.itemId}:${p.assigneeId}:${p.version}`;

  await tx.$executeRaw`
    INSERT INTO notifications (user_id, item_id, message, dedupe_key)
    VALUES (
      ${p.assigneeId}::uuid,
      ${p.itemId}::uuid,
      'You were assigned a work item',
      ${dedupeKey}
    )
    ON CONFLICT (dedupe_key) DO NOTHING
  `;
}

export const handlers: Record<string, (tx: Tx, payload: Record<string, unknown>) => Promise<void>> = {
  notify_new_assignee: notifyNewAssignee,
};