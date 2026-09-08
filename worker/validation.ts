import { z } from 'zod';

const singleLine = (value: string) => !/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80).refine(singleLine),
  email: z.string().trim().max(254).email('Please enter a valid email address.').transform(value => value.toLowerCase()),
  subject: z.string().trim().min(2, 'Please add a subject.').max(140).refine(singleLine),
  message: z.string().trim().min(20, 'Please write at least 20 characters.').max(5000).refine(value => !value.includes('\0')),
  website: z.string().max(500).optional().default(''),
  submissionId: z.string().uuid(),
});
export const statusSchema = z.object({ status: z.enum(['new', 'read', 'archived']) });

export function isSameOrigin(request: Request, siteUrl: string, appEnv: string): boolean {
  const origin = request.headers.get('Origin');
  const source = request.headers.get('Sec-Fetch-Site');
  if (source === 'cross-site') return false;
  if (!origin) return false;
  if (origin === new URL(siteUrl).origin && new URL(request.url).origin === origin) return true;
  // Wrangler may normalize the incoming request URL to 127.0.0.1 even when
  // the browser uses localhost. Both are accepted only for the local preview.
  const previewOrigins = ['http://localhost:8787', 'http://127.0.0.1:8787'];
  return appEnv === 'development' && previewOrigins.includes(origin) && previewOrigins.includes(new URL(request.url).origin);
}

export async function readJson(request: Request, maxBytes = 24000): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new InputError('Send this request as JSON.', 415);
  }
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes) throw new InputError('Your message is too large.', 413);
  if (!request.body) throw new InputError('Please include a message.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new InputError('Your message is too large.', 413);
      }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { all.set(chunk, position); position += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)); }
  catch { throw new InputError('The request could not be read.', 400); }
}

export class InputError extends Error {
  constructor(message: string, public status: 400 | 403 | 409 | 413 | 415 | 429) { super(message); }
}

export function safeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}
