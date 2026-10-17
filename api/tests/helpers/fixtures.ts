import { prisma } from '../../src/db/prisma';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import type { member_role, item_type } from '@prisma/client';

let cachedPasswordHash: string | null = null;

async function getPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await argon2.hash('password123');
  }
  return cachedPasswordHash;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export async function createTestUser(overrides: {
  email?: string;
  name?: string;
} = {}): Promise<TestUser> {
  const passwordHash = await getPasswordHash();
  const user = await prisma.users.create({
    data: {
      email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      name: overrides.name ?? 'Test User',
      password_hash: passwordHash,
    },
  });

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { id: user.id, email: user.email, name: user.name, token };
}

export async function createTestTeam(name?: string): Promise<{ id: string; name: string }> {
  const team = await prisma.teams.create({
    data: { name: name ?? `team-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });
  return { id: team.id, name: team.name };
}

export async function addMembership(
  userId: string,
  teamId: string,
  role: member_role,
): Promise<void> {
  await prisma.memberships.create({
    data: { user_id: userId, team_id: teamId, role },
  });
}

export async function createUserInTeam(role: member_role): Promise<{
  user: TestUser;
  teamId: string;
}> {
  const team = await createTestTeam();
  const user = await createTestUser();
  await addMembership(user.id, team.id, role);
  return { user, teamId: team.id };
}

export async function createTestItem(
  teamId: string,
  createdBy: string,
  overrides: {
    title?: string;
    type?: item_type;
    status?: string;
    assignee_id?: string;
    priority?: string;
  } = {},
): Promise<{ id: string; version: number }> {
  const item = await prisma.work_items.create({
    data: {
      team_id: teamId,
      title: overrides.title ?? `Test item ${Date.now()}`,
      type: overrides.type ?? 'task',
      created_by: createdBy,
      ...(overrides.assignee_id ? { assignee_id: overrides.assignee_id } : {}),
      ...(overrides.status ? { status: overrides.status as any } : {}), // <-- ADDED
      ...(overrides.priority ? { priority: overrides.priority as any } : {}), // <-- ADDED
    },
    select: { id: true, version: true },
  });
  return { id: item.id, version: item.version };
}

export function makeExpiredToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '0s' });
}