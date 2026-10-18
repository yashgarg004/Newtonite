import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem, addMembership } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Concurrent claim', () => {
  it('exactly one winner when 5 members claim at once', async () => {
    const { user: creator, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, creator.id);

    // Create 4 more members in the same team
    const claimers = [creator];
    for (let i = 0; i < 4; i++) {
      const { user } = await createUserInTeam('member');
      await addMembership(user.id, teamId, 'member');
      claimers.push(user);
    }

    const promises = claimers.map((u) =>
      request(app)
        .post(`/items/${item.id}/claim`)
        .set('Authorization', `Bearer ${u.token}`)
    );

    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([200, 409, 409, 409, 409]);

    const winnerIndex = results.findIndex((r) => r.status === 200);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    const winnerUser = claimers[winnerIndex]!;

    const updated = await prisma.work_items.findUnique({ where: { id: item.id } });
    expect(updated?.assignee_id).toBe(winnerUser.id);
    expect(updated?.version).toBe(item.version + 1);
    expect(updated?.status).toBe('in_progress');

    const events = await prisma.activity_events.findMany({
      where: { item_id: item.id, event_type: 'assignee_changed' },
    });
    expect(events.length).toBe(1);
  });
});