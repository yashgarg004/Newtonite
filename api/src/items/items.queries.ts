import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { decodeCursor, encodeCursor, Cursor } from '../lib/cursor';

export interface WorkItemSummary {
  id: string;
  team_id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_at: Date;
  cursor_ts: string;
}

export async function listItems(params: {
  teamIds: string[];
  status?: string;
  priority?: string;
  assigneeId?: string;
  q?: string;
  cursor?: string;
  limit: number;
}) {
  let cursor: Cursor | undefined;
  if (params.cursor) {
    cursor = decodeCursor(params.cursor);
  }

  const rows = await prisma.$queryRaw<WorkItemSummary[]>`
    SELECT w.id, w.team_id, w.title, w.status, w.priority, w.assignee_id, w.created_at, w.created_at::text AS cursor_ts
    FROM work_items w
    WHERE w.team_id = ANY(${params.teamIds}::uuid[])
    ${params.status ? Prisma.sql`AND w.status = ${params.status}::item_status` : Prisma.empty}
    ${params.priority ? Prisma.sql`AND w.priority = ${params.priority}::item_priority` : Prisma.empty}
    ${params.assigneeId ? Prisma.sql`AND w.assignee_id = ${params.assigneeId}::uuid` : Prisma.empty}
    ${params.q ? Prisma.sql`AND w.search @@ websearch_to_tsquery('english', ${params.q})` : Prisma.empty}
    ${cursor ? Prisma.sql`AND (w.created_at, w.id) < (${cursor.ts}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT ${params.limit + 1}
  `;

  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = items[items.length - 1];
    if (last) {
      nextCursor = encodeCursor({ ts: last.cursor_ts, id: last.id });
    }
  }

  return { items, nextCursor };
}

export async function getDashboard(
  userId: string,
  teamIds: string[],
  leadAdminTeamIds: string[],
) {
  const [assignedToMe, unassignedUrgent, awaitingApproval, recentlyResolved] = await Promise.all([
    prisma.$queryRaw<WorkItemSummary[]>`
      SELECT id, team_id, title, status, priority, assignee_id, created_at
      FROM work_items
      WHERE assignee_id = ${userId}::uuid
        AND status NOT IN ('resolved', 'closed')
        AND team_id = ANY(${teamIds}::uuid[])
      ORDER BY created_at DESC LIMIT 10
    `,
    prisma.$queryRaw<WorkItemSummary[]>`
      SELECT id, team_id, title, status, priority, assignee_id, created_at
      FROM work_items
      WHERE assignee_id IS NULL
        AND priority = 'urgent'
        AND status NOT IN ('resolved', 'closed')
        AND team_id = ANY(${teamIds}::uuid[])
      ORDER BY created_at DESC LIMIT 10
    `,
    prisma.$queryRaw<WorkItemSummary[]>`
      SELECT id, team_id, title, status, priority, assignee_id, created_at
      FROM work_items
      WHERE status = 'awaiting_approval'
        AND team_id = ANY(${leadAdminTeamIds}::uuid[])
      ORDER BY created_at DESC LIMIT 10
    `,
    prisma.$queryRaw<WorkItemSummary[]>`
      SELECT id, team_id, title, status, priority, assignee_id, created_at
      FROM work_items
      WHERE status IN ('resolved', 'closed')
        AND team_id = ANY(${teamIds}::uuid[])
      ORDER BY updated_at DESC LIMIT 10
    `,
  ]);

  return { assignedToMe, unassignedUrgent, awaitingApproval, recentlyResolved };
}