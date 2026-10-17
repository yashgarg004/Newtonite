import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem, addMembership } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Workflow', () => {
  it('open to closed gives 409 INVALID_TRANSITION', async () => {
    const { user, teamId } = await createUserInTeam('lead');
    const item = await createTestItem(teamId, user.id, { status: 'open' });

    await request(app)
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ to: 'closed', version: item.version })
      .expect(409)
      .then((res) => {
        expect(res.body.error.code).toBe('INVALID_TRANSITION');
      });
  });

  it('member approving gives 403 FORBIDDEN', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id, { status: 'awaiting_approval' });

    await request(app)
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ to: 'resolved', version: item.version })
      .expect(403)
      .then((res) => {
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
  });

  it('lead approving succeeds and increments version', async () => {
    const { user, teamId } = await createUserInTeam('lead');
    const item = await createTestItem(teamId, user.id, { status: 'awaiting_approval' });

    const res = await request(app)
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ to: 'resolved', version: item.version })
      .expect(200);

    expect(res.body.version).toBe(item.version + 1);
    expect(res.body.status).toBe('resolved');

    const events = await prisma.activity_events.findMany({
      where: { item_id: item.id, event_type: 'status_changed' },
    });
    expect(events.length).toBe(1);
    expect(events[0].from_value).toBe('awaiting_approval');
    expect(events[0].to_value).toBe('resolved');
  });

  it('assignee can move in_progress to awaiting_approval', async () => {
    const { user: lead, teamId } = await createUserInTeam('lead');
    const { user: assignee } = await createUserInTeam('member');
    await addMembership(assignee.id, teamId, 'member');

    const item = await createTestItem(teamId, lead.id, { status: 'in_progress', assignee_id: assignee.id });

    const res = await request(app)
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({ to: 'awaiting_approval', version: item.version })
      .expect(200);

    expect(res.body.status).toBe('awaiting_approval');
  });
});