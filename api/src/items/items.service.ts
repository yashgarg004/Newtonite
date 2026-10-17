import { inTransaction, Tx } from '../db/transaction';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app-error';
import { recordEvent } from './activity.service';
import { acquireKey, getKey, hashRequest, updateKeyResponse } from '../idempotency/idempotency';
import { authorize } from '../auth/authorize';
import type { AuthUser } from '../auth/auth.middleware';

export async function createItem(
  user: AuthUser,
  input: {
    key: string;
    method: string;
    path: string;
    body: { teamId: string; title: string; description: string; type: string; priority: string };
  },
) {
  const requestHash = hashRequest(input.method, input.path, input.body);

  return inTransaction(async (tx) => {
    const ownsKey = await acquireKey(tx, user.id, input.key, requestHash);

    if (!ownsKey) {
      const existing = await getKey(tx, user.id, input.key);
      if (!existing) {
        throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'Request is still processing');
      }
      if (existing.request_hash !== requestHash) {
        throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Key used with different body');
      }
      if (!existing.response_body) {
        throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'Request is still processing');
      }
      return { replay: true, status: existing.response_status as number, body: existing.response_body };
    }

    authorize(user, input.body.teamId, 'member');

    const item = await tx.work_items.create({
      data: {
        team_id: input.body.teamId,
        title: input.body.title,
        description: input.body.description,
        type: input.body.type as any,
        priority: input.body.priority as any,
        status: 'open',
        created_by: user.id,
      },
      select: {
        id: true, team_id: true, title: true, description: true,
        type: true, priority: true, status: true, version: true,
        created_by: true, created_at: true, updated_at: true,
      },
    });

    await recordEvent(tx, {
      itemId: item.id,
      actorId: user.id,
      type: 'created',
      payload: { title: item.title, type: item.type, priority: item.priority },
    });

    await updateKeyResponse(tx, user.id, input.key, 201, { item });

    return { replay: false, status: 201, body: { item } };
  });
}