# Engineering Decisions

## 1. SQL-first migrations with Prisma `db pull`
The handwritten SQL migration (`0001_init/migration.sql`) is the source of truth. PostgreSQL features such as generated `tsvector` columns, partial indexes, and append-only triggers are not fully modeled by Prisma's schema DSL.
- **Trade-off**: We retain full control over the database schema and performance characteristics. However, Prisma schema generation becomes a separate step (`prisma db pull`), and developers must strictly avoid `prisma migrate dev` or `prisma db push` to prevent Prisma from attempting to drop these advanced features.

## 2. PostgreSQL outbox instead of Redis or a dedicated message broker
Asynchronous jobs (like notifications) are stored in the `outbox_jobs` table within the same PostgreSQL database as the business data.
- **Trade-off**: This provides simpler infrastructure and strong transactional consistency (the job row commits atomically with the business change). The downside is lower throughput and higher database load compared to a dedicated queue like RabbitMQ or Redis.

## 3. Optimistic locking instead of pessimistic locking
Work item updates and transitions use a `version` column and conditional `UPDATE` statements (`WHERE version = ?`) rather than holding row-level locks (`FOR UPDATE`) during user think-time.
- **Trade-off**: This provides a much better experience for normal users and avoids database connection starvation. However, users may occasionally encounter a `409 VERSION_CONFLICT` and must reload the page to see the latest state.

## 4. Keyset pagination instead of offset pagination
Lists and dashboards use cursor-based pagination ordered by `(created_at DESC, id DESC)`, fetching `limit + 1` rows to determine if a next page exists.
- **Trade-off**: This guarantees stable results under concurrent inserts/updates and leverages the composite index efficiently. The downside is that the UI cannot display traditional "Page 1, 2, 3" numbers, only "Load More" or "Next" buttons.

## 5. Strict server-side workflow enforcement
All state transitions are validated against a strict `TRANSITIONS` map on the server, checking both the current status and the user's role, regardless of what buttons the UI displays.
- **Trade-off**: This makes the system completely safe from unauthorized state changes, even if the frontend is bypassed. However, it requires the frontend to handle more error states (e.g., `409 INVALID_TRANSITION`, `403 FORBIDDEN`) gracefully and provide clear feedback to the user.

---

## Known Limitations

1. **No real email/SMS sending**: Notifications are stored in the database only as a stand-in for a real email service.
2. **No refresh-token rotation**: JWTs have a fixed expiration (`24h`). A compromised token remains valid until it expires.
3. **No rate limiting**: The API does not currently implement rate limiting or DDoS protection.
4. **Single-instance worker in Docker Compose**: While the outbox worker uses `FOR UPDATE SKIP LOCKED` making it safe for horizontal scaling, the current `docker-compose.yml` runs a single worker instance for simplicity. True horizontal scaling would require careful monitoring of connection pool limits.
5. **Basic full-text search**: The search uses PostgreSQL's basic English `websearch_to_tsquery`. It is not typo-tolerant and does not support complex linguistic stemming beyond the default dictionary.
6. **No file attachments**: Work items and comments support text only; file uploads are out of scope for this implementation.