import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, createTestItem } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Pagination', () => {
  it('paginates items with cursor and returns all items without duplicates', async () => {
    const { user, teamId } = await createUserInTeam('member');
    
    // Create 30 items
    for (let i = 0; i < 30; i++) {
      await createTestItem(teamId, user.id, { title: `Item ${i}` });
    }

    const allItems: any[] = [];
    let cursor: string | undefined;

    // Fetch pages of 10
    do {
      const url = `/items?teamId=${teamId}&limit=10${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      allItems.push(...res.body.items);
      cursor = res.body.nextCursor || undefined;
    } while (cursor);

    expect(allItems.length).toBe(30);
    const ids = allItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(30); // No duplicates
  });

  it('filters items by status', async () => {
    const { user, teamId } = await createUserInTeam('member');
    await createTestItem(teamId, user.id, { title: 'Open Item', status: 'open' });
    await createTestItem(teamId, user.id, { title: 'Closed Item', status: 'closed' });

    const res = await request(app)
      .get(`/items?teamId=${teamId}&status=open`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toBe('Open Item');
  });
});