import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Idempotency', () => {
  it('creates item on first request and replays on second', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const key = `key-${Date.now()}`;
    const body = { teamId, title: 'Idempotent Item', type: 'task' };

    const res1 = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);

    const res2 = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);

    expect(res2.headers['idempotent-replay']).toBe('true');
    expect(res1.body.item.id).toBe(res2.body.item.id);
    
    const itemCount = await prisma.work_items.count({ where: { id: res1.body.item.id } });
    expect(itemCount).toBe(1);
    const keyCount = await prisma.idempotency_keys.count({ where: { key } });
    expect(keyCount).toBe(1);
  });

  it('5 parallel requests with one key create exactly one item', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const key = `key-parallel-${Date.now()}`;
    const body = { teamId, title: 'Parallel Item', type: 'task' };

    const promises = Array.from({ length: 5 }).map(() =>
      request(app)
        .post('/items')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Idempotency-Key', key)
        .send(body)
    );

    const results = await Promise.all(promises);
    results.forEach(res => expect([201]).toContain(res.status));

    const uniqueIds = new Set(results.map(r => r.body.item.id));
    expect(uniqueIds.size).toBe(1);

    const itemCount = await prisma.work_items.count({ where: { team_id: teamId, title: 'Parallel Item' } });
    expect(itemCount).toBe(1);
  });

  it('returns 422 when same key used with different body', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const key = `key-diff-${Date.now()}`;

    await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', key)
      .send({ teamId, title: 'First', type: 'task' })
      .expect(201);

    await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', key)
      .send({ teamId, title: 'Second', type: 'task' })
      .expect(422);
  });

  it('returns 400 when Idempotency-Key is missing', async () => {
    const { user, teamId } = await createUserInTeam('member');
    await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ teamId, title: 'No Key', type: 'task' })
      .expect(400);
  });
});