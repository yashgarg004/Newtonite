import { inTransaction } from '../db/transaction';
import { prisma } from '../db/prisma';
import { AppError } from '../errors/app-error';
import { recordEvent } from './activity.service';
import { acquireKey, getKey, hashRequest, updateKeyResponse } from '../idempotency/idempotency';
import { authorize } from '../auth/authorize';
import { ROLE_RANK, TRANSITIONS } from './transitions';
import { enqueueJob } from '../outbox/enqueue';
import type { AuthUser } from '../auth/auth.middleware';
import type { item_status, member_role, item_priority, item_type } from '@prisma/client';

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
    const inserted = await tx.$queryRaw<{ key: string }[]>`
      INSERT INTO idempotency_keys (user_id, key, request_hash)
      VALUES (${user.id}::uuid, ${input.key}, ${requestHash})
      ON CONFLICT (user_id, key) DO NOTHING
      RETURNING key
    `;

    if (inserted.length === 0) {
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
        type: input.body.type as item_type,
        priority: input.body.priority as item_priority,
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

export async function updateItem(
  user: AuthUser,
  itemId: string,
  input: { version: number; title?: string; description?: string; priority?: string; assignee_id?: string | null }
) {
  const item = await prisma.work_items.findUnique({
    where: { id: itemId },
    select: { id: true, team_id: true, created_by: true, assignee_id: true, status: true, priority: true },
  });

  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');

  const userRole = authorize(user, item.team_id, 'member');
  if (userRole !== 'admin' && userRole !== 'lead' && item.created_by !== user.id && item.assignee_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only edit items you created or are assigned to, unless you are a lead or admin');
  }

  if (input.assignee_id !== undefined && input.assignee_id !== item.assignee_id) {
    if (userRole !== 'admin' && userRole !== 'lead') {
      throw new AppError(403, 'FORBIDDEN', 'Only leads or admins can reassign items');
    }
    if (input.assignee_id) {
      const newAssignee = await prisma.memberships.findUnique({
        where: { user_id_team_id: { user_id: input.assignee_id, team_id: item.team_id } },
      });
      if (!newAssignee) {
        throw new AppError(422, 'ASSIGNEE_NOT_IN_TEAM', 'New assignee is not a member of the item\'s team');
      }
    }
  }

  return inTransaction(async (tx) => {
    const updated = await tx.work_items.updateMany({
      where: { id: itemId, version: input.version },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority !== undefined && { priority: input.priority as item_priority }),
        ...(input.assignee_id !== undefined && { assignee_id: input.assignee_id }),
        version: { increment: 1 },
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      const latest = await tx.work_items.findUnique({ where: { id: itemId } });
      if (!latest) throw new AppError(404, 'NOT_FOUND', 'Item not found');
      throw new AppError(409, 'VERSION_CONFLICT', 'Stale version', { current: latest });
    }

    if (input.title !== undefined || input.description !== undefined) {
      await recordEvent(tx, {
        itemId,
        actorId: user.id,
        type: 'edited',
        payload: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
        },
      });
    }

    if (input.priority !== undefined && input.priority !== item.priority) {
      await recordEvent(tx, {
        itemId,
        actorId: user.id,
        type: 'priority_changed',
        from: item.priority,
        to: input.priority,
      });
    }

    if (input.assignee_id !== undefined && input.assignee_id !== item.assignee_id) {
      await recordEvent(tx, { itemId, actorId: user.id, type: 'assignee_changed', from: item.assignee_id, to: input.assignee_id });
      await enqueueJob(tx, 'notify_new_assignee', { itemId, assigneeId: input.assignee_id, version: input.version + 1 });
    }

    return tx.work_items.findUnique({ where: { id: itemId } });
  });
}

export async function claimItem(user: AuthUser, itemId: string) {
  const item = await prisma.work_items.findUnique({
    where: { id: itemId },
    select: { id: true, team_id: true, status: true, assignee_id: true },
  });

  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');
  authorize(user, item.team_id, 'member');

  return inTransaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE work_items
      SET assignee_id = ${user.id}::uuid,
          status = 'in_progress'::item_status,
          version = version + 1,
          updated_at = now()
      WHERE id = ${itemId}::uuid
        AND assignee_id IS NULL
        AND status = 'open'::item_status
    `;

    if (Number(updated) === 0) {
      throw new AppError(409, 'ALREADY_CLAIMED', 'This item was already claimed or is no longer open');
    }

    await recordEvent(tx, { itemId, actorId: user.id, type: 'assignee_changed', from: null, to: user.id });
    await recordEvent(tx, { itemId, actorId: user.id, type: 'status_changed', from: 'open', to: 'in_progress' });

    return tx.work_items.findUnique({ where: { id: itemId } });
  });
}

export async function transitionItem(user: AuthUser, itemId: string, input: { to: string; version: number }) {
  const item = await prisma.work_items.findUnique({
    where: { id: itemId },
    select: { id: true, team_id: true, status: true, assignee_id: true },
  });

  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');

  // 1. Membership check (hides existence if not a member)
  const role = user.memberships.get(item.team_id);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Item not found');
  }

  // 2. Transition exists
  const transition = TRANSITIONS[item.status as item_status]?.[input.to as item_status];
  if (!transition) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot transition from ${item.status} to ${input.to}`);
  }

  // 3. Role allowed (checks minRole OR assigneeOk exception)
  const isAssignee = item.assignee_id === user.id;
  const rank = ROLE_RANK[role];
  const minRank = ROLE_RANK[transition.minRole];
  const allowed = rank >= minRank || (transition.assigneeOk === true && isAssignee && rank >= ROLE_RANK['member']);

  if (!allowed) {
    throw new AppError(403, 'FORBIDDEN', 'Your role does not allow this action');
  }

  return inTransaction(async (tx) => {
    const updated = await tx.work_items.updateMany({
      where: { id: itemId, status: item.status, version: input.version },
      data: { status: input.to as item_status, version: { increment: 1 }, updated_at: new Date() },
    });

    if (updated.count === 0) {
      const latest = await tx.work_items.findUnique({ where: { id: itemId } });
      if (!latest) throw new AppError(404, 'NOT_FOUND', 'Item not found');
      throw new AppError(409, 'VERSION_CONFLICT', 'Stale version', { current: latest });
    }

    await recordEvent(tx, { itemId, actorId: user.id, type: 'status_changed', from: item.status, to: input.to });
    return tx.work_items.findUnique({ where: { id: itemId } });
  });
}

export async function addComment(user: AuthUser, itemId: string, body: string) {
  const item = await prisma.work_items.findUnique({
    where: { id: itemId },
    select: { id: true, team_id: true },
  });

  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');
  authorize(user, item.team_id, 'member');

  return inTransaction(async (tx) => {
    const comment = await tx.comments.create({
      data: { item_id: itemId, author_id: user.id, body },
      select: { id: true, item_id: true, author_id: true, body: true, created_at: true },
    });

    await recordEvent(tx, {
      itemId,
      actorId: user.id,
      type: 'comment_added',
      payload: { commentId: comment.id.toString() },
    });

    return comment;
  });
}