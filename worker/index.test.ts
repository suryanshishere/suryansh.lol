import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { ObjectId } from 'mongodb';
import type { ContactDocument, Env } from './types';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), insertOne: vi.fn(), allowContact: vi.fn(), notifyContact: vi.fn(), withDb: vi.fn(),
}));
vi.mock('./db', () => ({
  withDb: mocks.withDb, allowContact: mocks.allowContact,
  ipDigest: vi.fn(async () => 'private-ip-digest'),
}));
vi.mock('./mail', () => ({ notifyContact: mocks.notifyContact }));
import { app } from './index';
import { contactSchema, isSameOrigin, readJson } from './validation';

const env: Env = {
  ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
  MONGODB_URI: 'mongodb://test.invalid', MONGODB_DB: 'test', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-google-secret',
  SESSION_SECRET: 'test-session-secret-that-has-more-than-thirty-two-characters',
  ADMIN_EMAIL: 'heresuryanshsingh@gmail.com', SITE_URL: 'https://suryansh.lol', APP_ENV: 'production',
  SMTP_HOST: 'test.invalid', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASS: 'test', MAIL_FROM: 'test@example.com',
};
const input = {
  name: 'Example Visitor', email: 'visitor@example.com', subject: 'A project idea',
  message: 'I would like to discuss a new website project with you.', website: '',
  submissionId: 'b59c01e9-329c-47d8-9c86-dbcf8b67ca15',
};

function request(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  return app.fetch(new Request(`${env.SITE_URL}${path}`, {
    method, headers: { Origin: env.SITE_URL, 'Content-Type': 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}

async function adminCookie(email = env.ADMIN_EMAIL, audience = 'admin') {
  const token = await new SignJWT({ email, name: 'Admin', csrfToken: 'test-csrf-token' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('suryansh-portfolio').setAudience(audience)
    .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(env.SESSION_SECRET));
  return `__Host-portfolio_session=${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ acknowledged: true });
  mocks.allowContact.mockResolvedValue({ allowed: true, retryAfter: 0 });
  mocks.notifyContact.mockResolvedValue('sent');
  mocks.withDb.mockImplementation(async (_env, operation) => operation({ collection: () => ({ findOne: mocks.findOne, insertOne: mocks.insertOne }) }));
});

describe('contact security and durable acceptance', () => {
  it('rejects cross-origin submissions before database access', async () => {
    const response = await request('/api/contact', 'POST', input, { Origin: 'https://attacker.example' });
    expect(response.status).toBe(403);
    expect(mocks.withDb).not.toHaveBeenCalled();
  });
  it('rejects honeypots and invalid emails without writing or sending', async () => {
    expect((await request('/api/contact', 'POST', { ...input, website: 'spam.example' })).status).toBe(400);
    expect((await request('/api/contact', 'POST', { ...input, email: 'not-an-email' })).status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
    expect(mocks.notifyContact).not.toHaveBeenCalled();
  });
  it('persists a valid message and reports successful delivery', async () => {
    const response = await request('/api/contact', 'POST', input);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, notification: 'sent' });
    const document = mocks.insertOne.mock.calls[0][0];
    expect(document).toMatchObject({ name: input.name, email: input.email, message: input.message, status: 'new' });
    expect(document).not.toHaveProperty('website');
    expect(document).not.toHaveProperty('ip');
    expect(mocks.notifyContact).toHaveBeenCalledOnce();
  });
  it('keeps an accepted message when email delivery fails and says notification is pending', async () => {
    mocks.notifyContact.mockResolvedValue('failed');
    const response = await request('/api/contact', 'POST', input);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, notification: 'pending' });
    expect(mocks.insertOne).toHaveBeenCalledOnce();
  });
  it('does not claim acceptance if database storage fails', async () => {
    mocks.insertOne.mockRejectedValue(new Error('private-database-connection-details'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request('/api/contact', 'POST', input);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-database');
    expect(mocks.notifyContact).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('blocks rate limited messages before writing or sending', async () => {
    mocks.allowContact.mockResolvedValue({ allowed: false, retryAfter: 123 });
    const response = await request('/api/contact', 'POST', input);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('123');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('reports the daily reset without promising access in ten minutes', async () => {
    mocks.allowContact.mockResolvedValue({ allowed: false, retryAfter: 45000 });
    const response = await request('/api/contact', 'POST', input);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45000');
    const body = await response.json() as { error: string; retryAfter: number };
    expect(body).toMatchObject({ retryAfter: 45000 });
    expect(body.error).not.toContain('10 minutes');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('makes repeated submissions idempotent and rejects reused keys with changed content', async () => {
    const document: ContactDocument = {
      _id: new ObjectId(), ...input, status: 'new', createdAt: new Date(), updatedAt: new Date(),
      notification: { status: 'sent', attempts: 1 },
    };
    mocks.findOne.mockResolvedValue(document);
    expect(await (await request('/api/contact', 'POST', input)).json()).toMatchObject({ ok: true, duplicate: true });
    expect((await request('/api/contact', 'POST', { ...input, message: 'A different message that reuses the same submission key.' })).status).toBe(409);
    expect(mocks.insertOne).not.toHaveBeenCalled();
    expect(mocks.notifyContact).not.toHaveBeenCalled();
  });
});

describe('admin authentication and CSRF', () => {
  it('does not expose the inbox to anonymous requests', async () => {
    expect((await request('/api/admin/contacts')).status).toBe(401);
    expect((await request('/api/admin/contacts/012345678901234567890123', 'PATCH', { status: 'read' })).status).toBe(401);
    expect(mocks.withDb).not.toHaveBeenCalled();
  });
  it('rejects sessions for other emails and the wrong audience', async () => {
    expect(await (await request('/api/auth/session', 'GET', undefined, { Cookie: await adminCookie('other@example.com') })).json()).toEqual({ authenticated: false });
    expect(await (await request('/api/auth/session', 'GET', undefined, { Cookie: await adminCookie(env.ADMIN_EMAIL, 'oauth') })).json()).toEqual({ authenticated: false });
  });
  it('returns a valid admin session without caching it', async () => {
    const response = await request('/api/auth/session', 'GET', undefined, { Cookie: await adminCookie() });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ authenticated: true, user: { email: env.ADMIN_EMAIL }, csrfToken: 'test-csrf-token' });
  });
  it('requires CSRF proof for authenticated mutations and clears a session only with proof', async () => {
    const Cookie = await adminCookie();
    expect((await request('/api/auth/logout', 'POST', {}, { Cookie })).status).toBe(403);
    expect((await request('/api/admin/contacts/012345678901234567890123', 'PATCH', { status: 'read' }, { Cookie })).status).toBe(403);
    const logout = await request('/api/auth/logout', 'POST', {}, { Cookie, 'X-CSRF-Token': 'test-csrf-token' });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(logout.headers.get('Set-Cookie')).toContain('HttpOnly');
  });
  it('rejects OAuth callbacks with no state proof', async () => {
    const response = await request('/api/auth/callback/google?code=attacker-code&state=attacker-state');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://suryansh.lol/admin/?error=auth');
    expect(response.headers.get('Set-Cookie')).not.toContain('__Host-portfolio_session');
  });
  it('creates an OAuth request with PKCE, nonce and protected state', async () => {
    const response = await request('/api/auth/google');
    const location = new URL(response.headers.get('Location')!);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('nonce')).toBeTruthy();
    expect(location.searchParams.get('redirect_uri')).toBe('https://suryansh.lol/api/auth/callback/google');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(response.headers.get('Set-Cookie')).toContain('Secure');
  });
});

describe('input boundaries', () => {
  it('rejects mail header injection', () => {
    expect(contactSchema.safeParse({ ...input, subject: 'hello\r\nBcc: attacker@example.com' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...input, name: 'Fake\nSender' }).success).toBe(false);
  });
  it('enforces the body byte limit even without Content-Length', async () => {
    const large = new Request('https://suryansh.lol/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(25000) }) });
    await expect(readJson(large)).rejects.toMatchObject({ status: 413 });
  });
  it('only accepts the local preview origin when explicitly configured for development', () => {
    const local = new Request('http://localhost:8787/api/contact', { headers: { Origin: 'http://localhost:8787' } });
    expect(isSameOrigin(local, 'https://suryansh.lol', 'production')).toBe(false);
    expect(isSameOrigin(local, 'https://suryansh.lol', 'development')).toBe(true);
    const normalized = new Request('http://127.0.0.1:8787/api/contact', { headers: { Origin: 'http://localhost:8787' } });
    expect(isSameOrigin(normalized, 'https://suryansh.lol', 'development')).toBe(true);
    expect(isSameOrigin(normalized, 'https://suryansh.lol', 'production')).toBe(false);
  });
});
