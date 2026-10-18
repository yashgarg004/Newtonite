import { Tx } from '../db/transaction';

interface NotifyNewAssigneePayload {
  assigneeId: string;
  itemId: string;
  version: number;
}

export async function notifyNewAssignee(
  tx: Tx,
  payload: NotifyNewAssigneePayload,
): Promise<void> {
  const dedupeKey = `assigned:${payload.itemId}:${payload.assigneeId}:${payload.version}`;

  await tx.$executeRaw`
    INSERT INTO notifications (user_id, item_id, message, dedupe_key)
    VALUES (
      ${payload.assigneeId}::uuid,
      ${payload.itemId}::uuid,
      'You were assigned a work item',
      ${dedupeKey}
    )
    ON CONFLICT (dedupe_key) DO NOTHING
  `;
}

export type JobHandler = (tx: Tx, payload: Record<string, unknown>) => Promise<void>;

export const handlers: Record<string, JobHandler> = {
  notify_new_assignee: (tx, payload) =>
    notifyNewAssignee(tx, payload as unknown as NotifyNewAssigneePayload),
};
