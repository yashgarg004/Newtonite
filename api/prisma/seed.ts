import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Fixed UUIDs for deterministic, idempotent seed
const TEAMS = {
  platform:   '10000000-0000-4000-8000-000000000001',
  support:    '10000000-0000-4000-8000-000000000002',
  payments:   '10000000-0000-4000-8000-000000000003',
  compliance: '10000000-0000-4000-8000-000000000004',
} as const;

const USERS = {
  alice:   '20000000-0000-4000-8000-000000000001',
  bob:     '20000000-0000-4000-8000-000000000002',
  charlie: '20000000-0000-4000-8000-000000000003',
  diana:   '20000000-0000-4000-8000-000000000004',
  eve:     '20000000-0000-4000-8000-000000000005',
  frank:   '20000000-0000-4000-8000-000000000006',
  grace:   '20000000-0000-4000-8000-000000000007',
  hank:    '20000000-0000-4000-8000-000000000008',
  ivy:     '20000000-0000-4000-8000-000000000009',
  jack:    '20000000-0000-4000-8000-000000000010',
} as const;

async function main(): Promise<void> {
  console.log('Seeding database...');

  const passwordHash = await argon2.hash('password123');

  // Upsert teams
  for (const [key, id] of Object.entries(TEAMS)) {
    const names: Record<string, string> = {
      platform: 'Platform Engineering',
      support: 'Customer Support',
      payments: 'Payments',
      compliance: 'Compliance',
    };
    await prisma.$executeRaw`
      INSERT INTO teams (id, name) VALUES (${id}::uuid, ${names[key]!})
      ON CONFLICT (id) DO NOTHING`;
  }

  // Upsert users
  const userList = [
    { id: USERS.alice,   email: 'alice@example.com',   name: 'Alice Admin' },
    { id: USERS.bob,     email: 'bob@example.com',     name: 'Bob Lead' },
    { id: USERS.charlie, email: 'charlie@example.com', name: 'Charlie Member' },
    { id: USERS.diana,   email: 'diana@example.com',   name: 'Diana Viewer' },
    { id: USERS.eve,     email: 'eve@example.com',     name: 'Eve Lead' },
    { id: USERS.frank,   email: 'frank@example.com',   name: 'Frank Member' },
    { id: USERS.grace,   email: 'grace@example.com',   name: 'Grace Admin' },
    { id: USERS.hank,    email: 'hank@example.com',    name: 'Hank Member' },
    { id: USERS.ivy,     email: 'ivy@example.com',     name: 'Ivy Lead' },
    { id: USERS.jack,    email: 'jack@example.com',    name: 'Jack Viewer' },
  ];
  for (const u of userList) {
    await prisma.$executeRaw`
      INSERT INTO users (id, email, name, password_hash)
      VALUES (${u.id}::uuid, ${u.email}, ${u.name}, ${passwordHash})
      ON CONFLICT (id) DO NOTHING`;
  }

  // Upsert memberships
  // Platform Engineering: alice=admin, bob=lead, charlie=member, diana=viewer
  // Customer Support: alice=viewer, eve=lead, frank=member
  // Payments: charlie=member, grace=admin, hank=member, jack=viewer
  // Compliance: frank=lead, hank=viewer, ivy=lead, jack=viewer
  const memberships: Array<[string, string, string]> = [
    [USERS.alice,   TEAMS.platform,   'admin'],
    [USERS.bob,     TEAMS.platform,   'lead'],
    [USERS.charlie, TEAMS.platform,   'member'],
    [USERS.diana,   TEAMS.platform,   'viewer'],
    [USERS.alice,   TEAMS.support,    'viewer'],
    [USERS.eve,     TEAMS.support,    'lead'],
    [USERS.frank,   TEAMS.support,    'member'],
    [USERS.charlie, TEAMS.payments,   'member'],
    [USERS.grace,   TEAMS.payments,   'admin'],
    [USERS.hank,    TEAMS.payments,   'member'],
    [USERS.jack,    TEAMS.payments,   'viewer'],
    [USERS.frank,   TEAMS.compliance, 'lead'],
    [USERS.hank,    TEAMS.compliance, 'viewer'],
    [USERS.ivy,     TEAMS.compliance, 'lead'],
    [USERS.jack,    TEAMS.compliance, 'viewer'],
  ];
  for (const [userId, teamId, role] of memberships) {
    await prisma.$executeRaw`
      INSERT INTO memberships (user_id, team_id, role)
      VALUES (${userId}::uuid, ${teamId}::uuid, ${role}::member_role)
      ON CONFLICT (user_id, team_id) DO NOTHING`;
  }

  // Check if items already exist (idempotent)
  const existing = await prisma.work_items.count();
  if (existing >= 5000) {
    console.log(`Already have ${existing} items, skipping item creation`);
  } else {
    // Create 5000 items with distinct created_at spread over 90 days
    await prisma.$executeRawUnsafe(`
      INSERT INTO work_items (team_id, title, description, type, priority, status, created_by, created_at, updated_at)
      SELECT
        CASE (s.i % 4)
          WHEN 0 THEN '${TEAMS.platform}'::uuid
          WHEN 1 THEN '${TEAMS.support}'::uuid
          WHEN 2 THEN '${TEAMS.payments}'::uuid
          ELSE        '${TEAMS.compliance}'::uuid
        END,
        'Work item #' || s.i,
        'Description for work item ' || s.i || '. Seeded for testing and demonstration.',
        (ARRAY['incident','customer_issue','payment','compliance','task']::item_type[])[1 + (s.i % 5)],
        (ARRAY['low','medium','high','urgent']::item_priority[])[1 + (s.i % 4)],
        CASE
          WHEN s.i % 7 = 0  THEN 'in_progress'::item_status
          WHEN s.i % 11 = 0 THEN 'awaiting_approval'::item_status
          WHEN s.i % 13 = 0 THEN 'resolved'::item_status
          WHEN s.i % 17 = 0 THEN 'closed'::item_status
          ELSE 'open'::item_status
        END,
        CASE (s.i % 4)
          WHEN 0 THEN '${USERS.alice}'::uuid
          WHEN 1 THEN '${USERS.eve}'::uuid
          WHEN 2 THEN '${USERS.grace}'::uuid
          ELSE        '${USERS.frank}'::uuid
        END,
        now() - ((5000 - s.i)::numeric / 5000 * 90) * interval '1 day' + s.i * interval '257 milliseconds',
        now() - ((5000 - s.i)::numeric / 5000 * 90) * interval '1 day' + s.i * interval '257 milliseconds'
      FROM generate_series(1, 5000) AS s(i)
      ON CONFLICT DO NOTHING
    `);
    console.log('Created 5000 work items');
  }

  console.log('Seed completed successfully');
  console.log('');
  console.log('Seeded logins (password: password123):');
  console.log('  alice@example.com   - Platform(admin),  Support(viewer)');
  console.log('  bob@example.com     - Platform(lead)');
  console.log('  charlie@example.com - Platform(member), Payments(member)');
  console.log('  diana@example.com   - Platform(viewer)');
  console.log('  eve@example.com     - Support(lead)');
  console.log('  frank@example.com   - Support(member),  Compliance(lead)');
  console.log('  grace@example.com   - Payments(admin)');
  console.log('  hank@example.com    - Payments(member), Compliance(viewer)');
  console.log('  ivy@example.com     - Compliance(lead)');
  console.log('  jack@example.com    - Payments(viewer), Compliance(viewer)');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
