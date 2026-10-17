import type { item_status, member_role } from '@prisma/client';

export const ROLE_RANK: Record<member_role, number> = {
  viewer: 0,
  member: 1,
  lead: 2,
  admin: 3,
};

export const TRANSITIONS: Record<
  item_status,
  Partial<Record<item_status, { minRole: member_role; assigneeOk?: boolean }>>
> = {
  open: { in_progress: { minRole: 'member' } },
  in_progress: { awaiting_approval: { minRole: 'lead', assigneeOk: true } },
  awaiting_approval: { resolved: { minRole: 'lead' }, in_progress: { minRole: 'lead' } },
  resolved: { closed: { minRole: 'lead' } },
  closed: {},
};