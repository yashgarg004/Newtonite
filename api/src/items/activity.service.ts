import { Prisma } from '@prisma/client';
import { Tx } from '../db/transaction';

export async function recordEvent(tx: Tx, e: {
  itemId: string;
  actorId: string | null;
  type: string;
  from?: string | null;
  to?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  await tx.activity_events.create({
    data: {
      item_id: e.itemId,
      actor_id: e.actorId,
      event_type: e.type,
      from_value: e.from ?? null,
      to_value: e.to ?? null,
      payload: e.payload ?? {},
    },
  });
}