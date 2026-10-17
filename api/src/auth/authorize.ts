import { AppError } from '../errors/app-error';
import type { AuthUser } from './auth.middleware';
import type { member_role } from '@prisma/client';

export type Role = member_role;

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  lead: 2,
  admin: 3,
};

export function authorize(user: AuthUser, teamId: string, minRole: Role): Role {
  const role = user.memberships.get(teamId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Item not found');
  }
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AppError(403, 'FORBIDDEN', 'Your role does not allow this action');
  }
  return role;
}