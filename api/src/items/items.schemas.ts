import { z } from 'zod';

export const updateItemSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
});

export const createItemSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().default(''),
  type: z.enum(['incident', 'customer_issue', 'payment', 'compliance', 'task']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
});

export const listItemsQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  status: z.enum(['open', 'in_progress', 'awaiting_approval', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const transitionSchema = z.object({
  to: z.enum(['open', 'in_progress', 'awaiting_approval', 'resolved', 'closed']),
  version: z.number().int().min(1),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(5000),
});