-- Migration: 0001_init
-- Creates all tables, indexes, functions, and triggers

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE member_role   AS ENUM ('viewer','member','lead','admin');
CREATE TYPE item_type     AS ENUM ('incident','customer_issue','payment','compliance','task');
CREATE TYPE item_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE item_status   AS ENUM ('open','in_progress','awaiting_approval','resolved','closed');
CREATE TYPE job_status    AS ENUM ('pending','processing','done','failed');

-- Identity and access
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role    member_role NOT NULL,
  PRIMARY KEY (user_id, team_id)
);
CREATE INDEX memberships_team_idx ON memberships (team_id);

-- Work items
CREATE TABLE work_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  type        item_type NOT NULL,
  priority    item_priority NOT NULL DEFAULT 'medium',
  status      item_status NOT NULL DEFAULT 'open',
  assignee_id uuid REFERENCES users(id),
  created_by  uuid NOT NULL REFERENCES users(id),
  due_date    timestamptz,
  version     integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  search      tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || description)
  ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX items_team_created_idx ON work_items (team_id, created_at DESC, id DESC);
CREATE INDEX items_team_status_prio_idx ON work_items (team_id, status, priority);
CREATE INDEX items_assignee_idx ON work_items (assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX items_unassigned_urgent_idx ON work_items (team_id, created_at DESC)
  WHERE assignee_id IS NULL AND priority = 'urgent'
  AND status NOT IN ('resolved','closed');
CREATE INDEX items_awaiting_idx ON work_items (team_id, created_at DESC)
  WHERE status = 'awaiting_approval';
CREATE INDEX items_search_idx ON work_items USING GIN (search);

-- Comments
CREATE TABLE comments (
  id         bigserial PRIMARY KEY,
  item_id    uuid NOT NULL REFERENCES work_items(id),
  author_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_item_idx ON comments (item_id, created_at);

-- Activity events (append-only history)
CREATE TABLE activity_events (
  id         bigserial PRIMARY KEY,
  item_id    uuid NOT NULL REFERENCES work_items(id),
  actor_id   uuid REFERENCES users(id),
  event_type text NOT NULL,
  from_value text,
  to_value   text,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_item_idx ON activity_events (item_id, id);

CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_events_append_only
  BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Idempotency keys
CREATE TABLE idempotency_keys (
  user_id         uuid NOT NULL REFERENCES users(id),
  key             text NOT NULL,
  request_hash    text NOT NULL,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Outbox jobs
CREATE TABLE outbox_jobs (
  id           bigserial PRIMARY KEY,
  type         text NOT NULL,
  payload      jsonb NOT NULL,
  status       job_status NOT NULL DEFAULT 'pending',
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at       timestamptz NOT NULL DEFAULT now(),
  locked_at    timestamptz,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX outbox_ready_idx ON outbox_jobs (run_at) WHERE status = 'pending';

-- Notifications
CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  item_id    uuid NOT NULL REFERENCES work_items(id),
  message    text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
