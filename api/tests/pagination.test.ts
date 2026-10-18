import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam } from './helpers/fixtures';
import { prisma } from '../src/db/prisma';

describe('Pagination and Search', () => {
  it('paginates 250 items with identical timestamps using limit 25 with no duplicates or gaps', async () => {
    const { user, teamId } = await createUserInTeam('member');

    // Insert 250 items in bulk with clusters of identical created_at timestamps
    await prisma.$executeRawUnsafe(`
      INSERT INTO work_items (team_id, title, description, type, priority, status, created_by, created_at, updated_at)
      SELECT
        '${teamId}'::uuid,
        'Item ' || s.i,
        'Description for item ' || s.i,
        'task'::item_type,
        'medium'::item_priority,
        'open'::item_status,
        '${user.id}'::uuid,
        now() - ((s.i / 25)::integer * interval '1 minute'),
        now() - ((s.i / 25)::integer * interval '1 minute')
      FROM generate_series(1, 250) AS s(i)
    `);

    const allItems: { id: string; title: string }[] = [];
    let cursor: string | undefined;
    let pagesCount = 0;

    // Fetch pages with limit 25
    do {
      const url = `/items?teamId=${teamId}&limit=25${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      pagesCount++;
      allItems.push(...res.body.items);
      cursor = res.body.nextCursor || undefined;
    } while (cursor);

    expect(allItems.length).toBe(250);
    expect(pagesCount).toBe(10);
    const ids = allItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(250); // Exactly 250 unique items, no duplicates or gaps
  });

  it('filters items by status and full-text search', async () => {
    const { user, teamId } = await createUserInTeam('member');

    await prisma.$executeRawUnsafe(`
      INSERT INTO work_items (team_id, title, description, type, priority, status, created_by)
      VALUES
        ('${teamId}'::uuid, 'Critical Database Outage', 'PostgreSQL cluster is unreachable', 'incident'::item_type, 'urgent'::item_priority, 'open'::item_status, '${user.id}'::uuid),
        ('${teamId}'::uuid, 'Routine Maintenance', 'Routine database index vacuuming', 'task'::item_type, 'low'::item_priority, 'closed'::item_status, '${user.id}'::uuid),
        ('${teamId}'::uuid, 'Payment Gateway Timeout', 'Stripe webhook latency spike', 'payment'::item_type, 'high'::item_priority, 'open'::item_status, '${user.id}'::uuid)
    `);

    // Search query 'Database'
    const searchRes = await request(app)
      .get(`/items?teamId=${teamId}&q=Database`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(searchRes.body.items.length).toBe(2);
    const titles = searchRes.body.items.map((i: { title: string }) => i.title);
    expect(titles).toContain('Critical Database Outage');
    expect(titles).toContain('Routine Maintenance');
    expect(titles).not.toContain('Payment Gateway Timeout');

    // Filter by status 'open'
    const statusRes = await request(app)
      .get(`/items?teamId=${teamId}&status=open`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(statusRes.body.items.length).toBe(2);
    const openTitles = statusRes.body.items.map((i: { title: string }) => i.title);
    expect(openTitles).toContain('Critical Database Outage');
    expect(openTitles).toContain('Payment Gateway Timeout');
    expect(openTitles).not.toContain('Routine Maintenance');
  });
});