import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { requireAuth } from '../auth/auth.middleware';
import { AppError } from '../errors/app-error';
import {
  createItemSchema,
  listItemsQuerySchema,
  updateItemSchema,
  transitionSchema,
  commentSchema,
} from './items.schemas';
import { listItems } from './items.queries';
import { createItem, updateItem, claimItem, transitionItem, addComment } from './items.service';
import { listActivity } from './activity.service';

const itemParamsSchema = z.object({ id: z.string().uuid() });
const idempotencyKeySchema = z.string().min(8).max(128);

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyHeader = req.headers['idempotency-key'];
    if (!keyHeader || typeof keyHeader !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing Idempotency-Key header');
    }
    const key = idempotencyKeySchema.parse(keyHeader);
    const body = createItemSchema.parse(req.body);

    const result = await createItem(req.user!, { key, method: req.method, path: req.path, body });
    if (result.replay) res.set('Idempotent-Replay', 'true');
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listItemsQuerySchema.parse(req.query);
    const user = req.user!;
    let teamIds = Array.from(user.memberships.keys());
    if (query.teamId) {
      if (!user.memberships.has(query.teamId)) return res.json({ items: [], nextCursor: null });
      teamIds = [query.teamId];
    }
    const result = await listItems({
      teamIds,
      status: query.status,
      priority: query.priority,
      assigneeId: query.assigneeId,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = itemParamsSchema.parse(req.params);
    const item = await prisma.work_items.findUnique({
      where: { id },
      select: {
        id: true, team_id: true, title: true, description: true,
        status: true, priority: true, type: true, version: true,
        created_by: true, assignee_id: true, due_date: true,
        created_at: true, updated_at: true,
      },
    });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');
    
    // Import authorize dynamically to avoid circular dependency if any, or just import it
    const { authorize } = await import('../auth/authorize.js');
    authorize(req.user!, item.team_id, 'viewer');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateItemSchema.parse(req.body);
    const { id } = itemParamsSchema.parse(req.params);
    const result = await updateItem(req.user!, id, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/claim', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = itemParamsSchema.parse(req.params);
    const result = await claimItem(req.user!, id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/transition', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = transitionSchema.parse(req.body);
    const { id } = itemParamsSchema.parse(req.params);
    const result = await transitionItem(req.user!, id, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = commentSchema.parse(req.body);
    const { id } = itemParamsSchema.parse(req.params);
    const result = await addComment(req.user!, id, body.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/activity', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = itemParamsSchema.parse(req.params);
    const item = await prisma.work_items.findUnique({ where: { id }, select: { id: true, team_id: true } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');
    
    const { authorize } = await import('../auth/authorize.js');
    authorize(req.user!, item.team_id, 'viewer');
    
    const events = await listActivity(id);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

export { router as itemRoutes };