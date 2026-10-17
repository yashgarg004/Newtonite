import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem } from './helpers/fixtures';
import * as activityService from '../src/items/activity.service';
import { prisma } from '../src/db/prisma';

describe('Atomic change', () => {
  it('rolls back item update if recordEvent fails', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id, { title: 'Original' });

    // Force recordEvent to throw
    vi.spyOn(activityService, 'recordEvent').mockImplementationOnce(() => {
      throw new Error('Forced failure');
    });

    await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Hacked', version: item.version })
      .expect(500);

    // Verify item is unchanged
    const unchanged = await prisma.work_items.findUnique({ where: { id: item.id } });
    expect(unchanged?.title).toBe('Original');
    expect(unchanged?.version).toBe(item.version);

    // Verify no event was written
    const events = await prisma.activity_events.findMany({ where: { item_id: item.id } });
    expect(events.length).toBe(0);

    vi.restoreAllMocks();
  });
});