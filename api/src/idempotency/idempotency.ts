import crypto from 'crypto';
import { Tx } from '../db/transaction';
import { AppError } from '../errors/app-error';

export function hashRequest(method: string, path: string, body: unknown): string {
  return crypto
    .createHash('sha256')
    .update(`${method}${path}${JSON.stringify(body)}`)
    .digest('hex');
}

export async function acquireKey(
  tx: Tx,
  userId: string,
  key: string,
  hash: string,
): Promise<boolean> {
  const inserted = await tx.$queryRaw<{ key: string }[]>`
    INSERT INTO idempotency_keys (user_id, key, request_hash)
    VALUES (${userId}::uuid, ${key}, ${hash})
    ON CONFLICT (user_id, key) DO NOTHING
    RETURNING key
  `;
  return inserted.length === 1;
}

export async function getKey(tx: Tx, userId: string, key: string) {
  return tx.idempotency_keys.findUnique({
    where: { user_id_key: { user_id: userId, key } },
  });
}

export async function updateKeyResponse(
  tx: Tx,
  userId: string,
  key: string,
  status: number,
  body: unknown,
) {
  await tx.idempotency_keys.update({
    where: { user_id_key: { user_id: userId, key } },
    data: { response_status: status, response_body: body as any },
  });
}