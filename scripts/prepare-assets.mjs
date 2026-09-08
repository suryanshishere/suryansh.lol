import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Next embeds hydration data in inline scripts. Hash the final build output so
// scripts have an explicit allowlist without allowing arbitrary inline code.
const hashes = new Set();
for (const entry of await readdir('out', { withFileTypes: true, recursive: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
  const source = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(match[1]) || !match[2]) continue;
    hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  }
}
const policy = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join('; ');

await writeFile('out/_headers', `/*
  Content-Security-Policy: ${policy}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=15552000
/admin*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/Suryansh-Singh-Resume.docx
  Content-Disposition: attachment; filename="Suryansh-Singh-Resume.docx"
`);
console.log(`Prepared Cloudflare headers with ${hashes.size} inline script hashes.`);
