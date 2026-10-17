import { AppError } from '../errors/app-error';

export interface Cursor {
  ts: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(encoded: string): Cursor {
  try {
    const json: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (
      typeof json !== 'object' ||
      json === null ||
      !('ts' in json) ||
      !('id' in json) ||
      typeof (json as Record<string, unknown>).ts !== 'string' ||
      typeof (json as Record<string, unknown>).id !== 'string'
    ) {
      throw new Error('Invalid cursor shape');
    }
    return json as Cursor;
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid pagination cursor');
  }
}
