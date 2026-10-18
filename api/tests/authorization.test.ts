import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem, addMembership } from './helpers/fixtures';

describe('Authorization', () => {
  it('returns 401 for missing token', async () => {
    const res = await request(app).get('/items/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for invalid token', async () => {
    const res = await request(app)
      .get('/items/00000000-0000-0000-0000-000000000001')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 for cross-team access across all endpoints and hides from list/search', async () => {
    // Create Team A and User A (member)
    const { user: userA, teamId: teamA } = await createUserInTeam('member');
    // Create Team B and User B (member)
    const { user: userB, teamId: teamB } = await createUserInTeam('member');

    // Create an item in Team A
    const item = await createTestItem(teamA, userA.id, { title: 'Secret Team A Item' });

    // User B tries GET /items/:id
    const getRes = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('NOT_FOUND');

    // User B tries PATCH /items/:id
    const patchRes = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Hacked', version: item.version });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe('NOT_FOUND');

    // User B tries POST /items/:id/claim
    const claimRes = await request(app)
      .post(`/items/${item.id}/claim`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(claimRes.status).toBe(404);
    expect(claimRes.body.error.code).toBe('NOT_FOUND');

    // User B tries POST /items/:id/transition
    const transitionRes = await request(app)
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ to: 'in_progress', version: item.version });
    expect(transitionRes.status).toBe(404);
    expect(transitionRes.body.error.code).toBe('NOT_FOUND');

    // User B tries POST /items/:id/comments
    const commentRes = await request(app)
      .post(`/items/${item.id}/comments`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ body: 'Infiltrating comment' });
    expect(commentRes.status).toBe(404);
    expect(commentRes.body.error.code).toBe('NOT_FOUND');

    // User B tries GET /items/:id/activity
    const actRes = await request(app)
      .get(`/items/${item.id}/activity`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(actRes.status).toBe(404);
    expect(actRes.body.error.code).toBe('NOT_FOUND');

    // Item must be absent from User B's list and search results
    const listRes = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(listRes.status).toBe(200);
    const listedIds = (listRes.body.items as { id: string }[]).map((i) => i.id);
    expect(listedIds).not.toContain(item.id);

    const searchRes = await request(app)
      .get('/items?q=Secret')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(searchRes.status).toBe(200);
    const searchIds = (searchRes.body.items as { id: string }[]).map((i) => i.id);
    expect(searchIds).not.toContain(item.id);
  });

  it('returns 403 for viewer trying to write', async () => {
    const { user: viewer, teamId } = await createUserInTeam('viewer');
    const { user: member } = await createUserInTeam('member');
    await addMembership(member.id, teamId, 'member');

    const item = await createTestItem(teamId, member.id);

    // Viewer tries to PATCH the item
    const patchRes = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ title: 'Viewer Edit', version: item.version });
    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('FORBIDDEN');

    // Viewer tries to claim
    const claimRes = await request(app)
      .post(`/items/${item.id}/claim`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(claimRes.status).toBe(403);
    expect(claimRes.body.error.code).toBe('FORBIDDEN');

    // Viewer tries to comment
    const commentRes = await request(app)
      .post(`/items/${item.id}/comments`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ body: 'Viewer comment' });
    expect(commentRes.status).toBe(403);
    expect(commentRes.body.error.code).toBe('FORBIDDEN');

    // Viewer tries to create item
    const createRes = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${viewer.token}`)
      .set('Idempotency-Key', `viewer-key-${Date.now()}`)
      .send({ teamId, title: 'Viewer Created', type: 'task' });
    expect(createRes.status).toBe(403);
    expect(createRes.body.error.code).toBe('FORBIDDEN');
  });

  it('allows member to read item in their team', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const item = await createTestItem(teamId, user.id);

    const res = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
  });
});