# suryansh.lol

Suryansh Singh's portfolio: Next.js static pages, a Cloudflare Worker for contact and admin APIs, MongoDB for the private inbox, and Google sign-in for the owner.

## Run locally

```sh
npm ci
npm run build
npm run preview
```

Open `http://localhost:8787`. The preview runs both the exported website and the real Worker APIs. `npm run dev` starts the Next.js design preview; it does not provide the Worker API.

Copy `.dev.vars.example` to `.dev.vars` and fill in the local secrets before using contact or sign-in. This checkout has already been configured from the owner's existing credentials. `.dev.vars`, `.local/`, and build outputs are ignored by Git. Local preview uses the configured MongoDB and mail server, so submitting its contact form sends a real notification.

## Configuration

| Name | Location | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Worker secret | TLS connection to the existing Atlas cluster |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Worker secrets | Existing Google OAuth web client |
| `SESSION_SECRET` | Worker secret | Portfolio-specific random signing key, at least 32 characters |
| `SMTP_USER`, `SMTP_PASS` | Worker secrets | Existing Gmail SMTP credentials |
| `MONGODB_DB` | `wrangler.jsonc` | `suryansh_portfolio`, separate from other apps |
| `ADMIN_EMAIL` | `wrangler.jsonc` | `heresuryanshsingh@gmail.com` |
| `SITE_URL` | `wrangler.jsonc` | `https://suryansh.lol` |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | `wrangler.jsonc` | Existing verified notification sender |
| `APP_ENV` | `wrangler.jsonc` | Production cookie and origin protection |

Local `.dev.vars` overrides `SITE_URL` to `http://localhost:8787` and `APP_ENV` to `development`. Do not upload these two overrides to production. Production variables are kept in `wrangler.jsonc`; the upload script sends only the six approved secret names.

The configured Atlas URI uses explicit replica-set hosts with TLS because this computer's SRV DNS requests are refused. The hosts and replica-set options were resolved from Atlas's SRV/TXT records over HTTPS. If the Atlas cluster is moved, refresh the URI using its current connection information. TLS certificate validation stays enabled.

## Google sign-in

In the existing Google OAuth web client's **Authorized redirect URIs**, add:

```text
https://suryansh.lol/api/auth/callback/google
```

For local sign-in, also add `http://localhost:8787/api/auth/callback/google`. Existing redirect URIs for other projects must remain present. Google must accept the exact callback before sign-in will work; the client secret alone cannot register a new callback.

Visit `/admin/` and sign in with `heresuryanshsingh@gmail.com`. Other Google accounts are rejected even when their email is verified. OAuth uses PKCE, signed state, a nonce, and Google's verified ID-token signatures. The four-hour session uses an HttpOnly, Secure, SameSite cookie in production. Admin mutations require same-origin requests plus the session's CSRF token.

## Deploy to Cloudflare

The Worker is `suryansh-portfolio`, in the existing Cloudflare account and `suryansh.lol` zone. It uses Worker routes `suryansh.lol/*` and `www.suryansh.lol/*` over the existing proxied DNS records. These records remain in place. The Worker serves the complete portfolio and redirects www page visits to the apex. Existing project subdomains are separate Workers.

```sh
npm run typecheck
npm test
npm run build
npx wrangler whoami
node scripts/upload-worker-secrets.mjs
npx wrangler deploy
```

`upload-worker-secrets.mjs` reads only the required secrets from the ignored local file and passes them to Wrangler through stdin. It never prints their values or stores them in the website bundle. On first use, Wrangler may create the new Worker before uploading the secrets. Subsequent deploys preserve existing remote secrets; re-run the upload only when configuring or rotating them. Never run secret commands with literal credentials in command arguments.

The homepage, admin document and `/api/*` go through the small Worker to support canonical host redirects and API routing; other static assets are served directly by Cloudflare. Public page rendering does not query MongoDB. The site is exported at build time, so editing portfolio content requires another build/deploy.

## Contact and inbox behavior

`POST /api/contact` accepts JSON `{ name, email, subject, message, website, submissionId }`. `website` is an empty honeypot; generate `submissionId` once with `crypto.randomUUID()` and reuse it when retrying the same message. Accepted messages are stored before notification delivery. A successful SMTP acceptance returns `notification: "sent"`; if email fails, the message stays in the inbox and the response explicitly returns `notification: "pending"`. SMTP acceptance confirms the mail server accepted delivery; it is not an inbox-placement guarantee.

Messages have `new`, `read`, or `archived` status. The admin inbox supports case-insensitive literal search, status filters, 20 messages per page, status updates, and retrying a failed notification. Retry has a one-minute cooldown and a database lease to prevent concurrent sends. The email's Reply-To is the visitor, while its From remains the existing verified sender.

The API validates fields and byte limits, rejects cross-origin submissions and mail-header injection, and uses unique submission IDs to prevent duplicate entries. Rate limits allow three submissions per ten-minute bucket and ten per day for a connection; MongoDB stores only an HMAC digest of the IP, and expired rate buckets are removed by a TTL index. This is a small portfolio anti-spam control, not a full abuse prevention service.

Collections and indexes are created automatically on the first database request. Each database request opens and closes its own small MongoDB connection pool because Cloudflare sockets cannot be shared across ordinary Worker requests. A scheduled Worker checks failed and pending notifications every 15 minutes. It makes at most five total attempts, with 15, 30, 60, and 120 minute backoff, in batches of up to five. Each send has a 25-second deadline and an owned 90-second lease. Notification failures remain visible in the admin inbox and can still be retried manually after automatic retries are exhausted. Rotate `SESSION_SECRET` to invalidate all existing admin sessions.

## Verification

`npm test` covers unauthorized inbox access, wrong-user sessions, CSRF, OAuth state and PKCE, byte limits, email header injection, rate-limit rejection, idempotency, and the distinction between database acceptance and email failure. Tests use an isolated mocked database and do not send mail.

The real local Workers runtime was separately verified with one labeled contact message: MongoDB saved exactly one entry, SMTP accepted one notification, retrying the same request created no duplicate, admin search and status changes worked, and the test entry was removed afterward. Complete a Google sign-in after registering the production callback, then verify the deployed site's contact form and admin inbox.


## Browser checks

With a built preview running, `npm run test:e2e` exercises responsive layouts, contact success/failure recovery using mocked APIs, admin inbox flows, keyboard controls, and Axe accessibility checks. Set `TEST_BASE_URL` and `ADMIN_TEST_BASE_URL` if the preview uses a different port; the included scripts default to 8788 for the isolated QA preview. Install Chromium with `npx playwright install chromium` on a new machine, or set `PLAYWRIGHT_BROWSER_EXECUTABLE`. Stop Wrangler before rebuilding on Windows to avoid locking the `out` directory.

The custom illustration and its full imagegen prompts are documented in `docs/illustration.md`. Fonts are self-hosted; their OFL licenses are in `docs/fonts`. Project screenshots were captured from the actual public websites.
