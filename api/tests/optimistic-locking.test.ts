import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestUser, addMembership, createTestItem } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Stale update', () => {
  it('second PATCH with old version gets 409 with latest item', async () => {
    const { user: userA, teamId } = await createUserInTeam('lead');
    const userB = await createTestUser();
    await addMembership(userB.id, teamId, 'lead');

    const item = await createTestItem(teamId, userA.id, { title: 'Original' });
    const initialVersion = item.version;

    // Both clients saw initialVersion (version 1)
    // Client A updates title
    const res1 = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'First Update by User A', version: initialVersion })
      .expect(200);

    expect(res1.body.version).toBe(initialVersion + 1);
    expect(res1.body.title).toBe('First Update by User A');

    // Client B attempts to update with stale initialVersion (version 1)
    const res2 = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Second Update by User B', version: initialVersion })
      .expect(409);

    expect(res2.body.error.code).toBe('VERSION_CONFLICT');
    expect(res2.body.error.details.current.version).toBe(initialVersion + 1);
    expect(res2.body.error.details.current.title).toBe('First Update by User A');

    // Verify database state retains Client A's update
    const dbItem = await prisma.work_items.findUnique({ where: { id: item.id } });
    expect(dbItem?.title).toBe('First Update by User A');
    expect(dbItem?.version).toBe(initialVersion + 1);
  });
});