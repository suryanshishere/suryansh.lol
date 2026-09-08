import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import type { AdminSession, Env } from './types';

const ISSUER = 'suryansh-portfolio';
const SESSION_COOKIE = '__Host-portfolio_session';
const OAUTH_COOKIE = '__Host-portfolio_oauth';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function cookieName(env: Env, name: string) { return env.APP_ENV === 'development' ? name.replace('__Host-', '') : name; }
function signingKey(env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Authentication is not configured.');
  return new TextEncoder().encode(env.SESSION_SECRET);
}
function cookie(env: Env, name: string, value: string, seconds: number) {
  return `${cookieName(env, name)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${env.APP_ENV === 'development' ? '' : '; Secure'}`;
}
function getCookie(request: Request, name: string): string | null {
  for (const value of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...parts] = value.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return null;
}
function checkGoogle(env: Env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google is not configured.');
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function randomToken(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }

export async function beginGoogle(env: Env): Promise<Response> {
  checkGoogle(env);
  const state = randomToken();
  const codeVerifier = randomToken();
  const nonce = randomToken();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.SITE_URL}/api/auth/callback/google`,
    response_type: 'code', scope: 'openid email profile',
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  const token = await new SignJWT({ state, codeVerifier, nonce })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience('oauth')
    .setIssuedAt().setExpirationTime('10m').sign(signingKey(env));
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Set-Cookie': cookie(env, OAUTH_COOKIE, token, 600) } });
}

export async function finishGoogle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const clear = cookie(env, OAUTH_COOKIE, '', 0);
  const fail = (reason: string) => new Response(null, { status: 302, headers: { Location: `${env.SITE_URL}/admin/?error=${reason}`, 'Set-Cookie': clear } });
  if (url.searchParams.has('error')) return fail('auth');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const proof = getCookie(request, cookieName(env, OAUTH_COOKIE));
  if (!code || !state || !proof) return fail('auth');
  try {
    const { payload } = await jwtVerify(proof, signingKey(env), { algorithms: ['HS256'], issuer: ISSUER, audience: 'oauth' });
    if (payload.state !== state || typeof payload.codeVerifier !== 'string' || typeof payload.nonce !== 'string') return fail('auth');
    checkGoogle(env);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        code, code_verifier: payload.codeVerifier, grant_type: 'authorization_code',
        redirect_uri: `${env.SITE_URL}/api/auth/callback/google`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return fail('auth');
    const tokens = await tokenResponse.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== 'string') return fail('auth');
    const { payload: identity } = await jwtVerify(tokens.id_token, keys, {
      algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID,
    });
    if (identity.nonce !== payload.nonce || identity.email_verified !== true || typeof identity.sub !== 'string' || typeof identity.email !== 'string') return fail('auth');
    if (identity.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return fail('access_denied');
    const token = await new SignJWT({
      email: identity.email.toLowerCase(), name: typeof identity.name === 'string' ? identity.name : 'Suryansh',
      picture: typeof identity.picture === 'string' ? identity.picture : undefined, csrfToken: randomToken(),
    }).setProtectedHeader({ alg: 'HS256' }).setSubject(identity.sub).setIssuer(ISSUER).setAudience('admin')
      .setIssuedAt().setExpirationTime('4h').sign(signingKey(env));
    const headers = new Headers({ Location: `${env.SITE_URL}/admin/` });
    headers.append('Set-Cookie', clear);
    headers.append('Set-Cookie', cookie(env, SESSION_COOKIE, token, 14400));
    return new Response(null, { status: 302, headers });
  } catch { return fail('auth'); }
}

export async function authenticate(request: Request, env: Env): Promise<AdminSession | null> {
  const token = getCookie(request, cookieName(env, SESSION_COOKIE));
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(env), { algorithms: ['HS256'], issuer: ISSUER, audience: 'admin' });
    if (payload.email !== env.ADMIN_EMAIL.toLowerCase() || typeof payload.csrfToken !== 'string' || typeof payload.name !== 'string') return null;
    return { email: payload.email as string, name: payload.name, csrfToken: payload.csrfToken, picture: typeof payload.picture === 'string' ? payload.picture : undefined };
  } catch { return null; }
}

export function clearSession(env: Env) { return cookie(env, SESSION_COOKIE, '', 0); }
