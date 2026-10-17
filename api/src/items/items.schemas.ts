import { z } from 'zod';

export const updateItemSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(1).max(200).optional(),
});