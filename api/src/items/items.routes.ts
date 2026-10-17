import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { requireAuth } from '../auth/auth.middleware';
import { authorize } from '../auth/authorize';
import { AppError } from '../errors/app-error';
import { updateItemSchema } from './items.schemas';

const itemParamsSchema = z.object({
  id: z.string().uuid(),
});

const router = Router();

router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = itemParamsSchema.parse(req.params);

    const item = await prisma.work_items.findUnique({
      where: { id },
      select: {
        id: true,
        team_id: true,
        title: true,
        status: true,
        priority: true,
        version: true,
        created_by: true,
        assignee_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    authorize(req.user!, item.team_id, 'viewer');

    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = itemParamsSchema.parse(req.params);
    const body = updateItemSchema.parse(req.body);

    const item = await prisma.work_items.findUnique({
      where: { id },
      select: { id: true, team_id: true },
    });

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    authorize(req.user!, item.team_id, 'member');

    res.json({ id: item.id, message: 'updated' });
  } catch (err) {
    next(err);
  }
});

export { router as itemRoutes };