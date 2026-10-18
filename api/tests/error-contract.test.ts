import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUserInTeam, makeExpiredToken } from './helpers/fixtures';

describe('Error contract', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{invalid json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Malformed JSON');
  });

  it('returns 400 with details for bad request body', async () => {
    const { user, teamId } = await createUserInTeam('member');
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', `bad-body-${Date.now()}`)
      .send({ teamId, title: '', type: 'invalid_type' }); // empty title and bad type

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toHaveProperty('details');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when expired token is provided', async () => {
    const { user } = await createUserInTeam('member');
    const expiredToken = makeExpiredToken(user.id);
    const res = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toContain('Invalid or expired token');
  });

  it('returns health check successfully', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('never exposes stack traces in error responses', async () => {
    const res = await request(app).get('/nonexistent-route');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('stack');
    expect(body).not.toContain('at ');
  });

  it('never exposes password_hash in login response', async () => {
    const { user } = await createUserInTeam('member');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'password123' })
      .expect(200);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('password_hash');
    expect(bodyStr).not.toContain('argon2');
  });

  it('error response has standard shape { error: { code, message, details? } }', async () => {
    const res = await request(app).get('/nonexistent-route');
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
  });
});
