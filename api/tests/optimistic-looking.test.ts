import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Stale update', () => {
  it('second PATCH with old version gets 409 with latest item', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id, { title: 'Original' });

    // First PATCH succeeds
    const res1 = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'First Update', version: item.version })
      .expect(200);

    expect(res1.body.version).toBe(item.version + 1);

    // Second PATCH with old version fails
    const res2 = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Second Update', version: item.version })
      .expect(409);

    expect(res2.body.error.code).toBe('VERSION_CONFLICT');
    expect(res2.body.error.details.current.version).toBe(item.version + 1);
    expect(res2.body.error.details.current.title).toBe('First Update');

    // Verify database state
    const dbItem = await prisma.work_items.findUnique({ where: { id: item.id } });
    expect(dbItem?.title).toBe('First Update');
    expect(dbItem?.version).toBe(item.version + 1);
  });
});