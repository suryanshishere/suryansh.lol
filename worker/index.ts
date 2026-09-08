import { Hono } from 'hono';
import { MongoServerError, ObjectId, type Filter } from 'mongodb';
import { authenticate, beginGoogle, clearSession, finishGoogle } from './auth';
import { allowContact, ipDigest, withDb } from './db';
import { notifyContact } from './mail';
import { retryPendingNotifications } from './retries';
import { contactSchema, InputError, isSameOrigin, readJson, safeEqual, statusSchema } from './validation';
import type { AdminSession, ContactDocument, Env } from './types';

export const app = new Hono<{ Bindings: Env; Variables: { admin: AdminSession } }>();

app.use('/api/*', async (context, next) => {
  context.header('Cache-Control', 'no-store');
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  context.header('X-Frame-Options', 'DENY');
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(context.req.method) && !isSameOrigin(context.req.raw, context.env.SITE_URL, context.env.APP_ENV)) {
    return context.json({ error: 'This request must come from this website.' }, 403);
  }
  await next();
});

app.get('/api/auth/google', async context => {
  try { return await beginGoogle(context.env); }
  catch { return context.redirect(`${context.env.SITE_URL}/admin/?error=configuration`); }
});
app.get('/api/auth/callback/google', context => finishGoogle(context.req.raw, context.env));
app.get('/api/auth/session', async context => {
  const session = await authenticate(context.req.raw, context.env);
  if (!session) return context.json({ authenticated: false });
  const { csrfToken, ...user } = session;
  return context.json({ authenticated: true, user, csrfToken });
});
app.post('/api/auth/logout', async context => {
  const session = await authenticate(context.req.raw, context.env);
  if (!session) return context.json({ error: 'Please sign in.' }, 401);
  if (!safeEqual(context.req.header('X-CSRF-Token') || '', session.csrfToken)) return context.json({ error: 'Refresh the page and try again.' }, 403);
  context.header('Set-Cookie', clearSession(context.env));
  return context.json({ ok: true });
});

app.post('/api/contact', async context => {
  const parsed = contactSchema.safeParse(await readJson(context.req.raw));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0], issue.message]));
    return context.json({ error: 'Please check the highlighted fields.', fields }, 400);
  }
  if (parsed.data.website.trim()) return context.json({ error: 'Your message could not be accepted.' }, 400);
  const { website: _honeypot, ...data } = parsed.data;
  void _honeypot;
  return withDb(context.env, async db => {
    const collection = db.collection<ContactDocument>('contacts');
    let existing = await collection.findOne({ submissionId: data.submissionId });
    if (!existing) {
      const rateLimit = await allowContact(db, await ipDigest(context.req.raw, context.env.SESSION_SECRET));
      if (!rateLimit.allowed) {
        context.header('Retry-After', String(rateLimit.retryAfter));
        return context.json({ error: 'The message limit for your connection has been reached. Please try again later, or email me directly.', retryAfter: rateLimit.retryAfter }, 429);
      }
      const now = new Date();
      const contact: ContactDocument = {
        _id: new ObjectId(), ...data, status: 'new', createdAt: now, updatedAt: now,
        notification: { status: 'pending', attempts: 0 },
      };
      try { await collection.insertOne(contact); }
      catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
        existing = await collection.findOne({ submissionId: data.submissionId });
        if (!existing) throw error;
      }
      if (!existing) {
        // The durable message is the primary result. Email status stays honest,
        // and the admin can retry notification delivery without losing a lead.
        let notification: 'sent' | 'pending' | 'failed' = 'pending';
        try { notification = await notifyContact(db, contact._id, context.env); }
        catch { console.error('Portfolio notification status update failed.'); }
        return context.json({
          ok: true, id: contact._id.toHexString(), notification: notification === 'sent' ? 'sent' : 'pending',
          message: notification === 'sent' ? 'Message received. I’ll get back to you soon.' : 'Your message is saved in my inbox. The email notification is pending.',
        }, 201);
      }
    }
    // A submission key only represents the original payload. Never allow it to
    // overwrite a stored message or to reveal another message's contents.
    if (existing.name !== data.name || existing.email !== data.email || existing.subject !== data.subject || existing.message !== data.message) {
      return context.json({ error: 'This submission was already used. Refresh the page to send a new message.' }, 409);
    }
    return context.json({
      ok: true, id: existing._id.toHexString(), duplicate: true,
      notification: existing.notification.status === 'sent' ? 'sent' : 'pending',
      message: 'Your message is already saved in my inbox.',
    });
  });
});

app.use('/api/admin/*', async (context, next) => {
  const session = await authenticate(context.req.raw, context.env);
  if (!session) return context.json({ error: 'Please sign in to view your inbox.' }, 401);
  if (context.req.method !== 'GET' && !safeEqual(context.req.header('X-CSRF-Token') || '', session.csrfToken)) {
    return context.json({ error: 'Refresh the page and try again.' }, 403);
  }
  context.set('admin', session);
  await next();
});

function serialize(contact: ContactDocument) {
  return {
    id: contact._id.toHexString(), name: contact.name, email: contact.email, subject: contact.subject,
    message: contact.message, status: contact.status, createdAt: contact.createdAt.toISOString(), updatedAt: contact.updatedAt.toISOString(),
    notification: {
      status: contact.notification.status, attempts: contact.notification.attempts,
      lastAttemptAt: contact.notification.lastAttemptAt?.toISOString(), sentAt: contact.notification.sentAt?.toISOString(),
    },
  };
}

app.get('/api/admin/contacts', async context => {
  const status = context.req.query('status');
  if (status && !['all', 'new', 'read', 'archived'].includes(status)) return context.json({ error: 'Unknown inbox filter.' }, 400);
  const rawPage = context.req.query('page') || '1';
  if (!/^\d{1,5}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 10000) return context.json({ error: 'Invalid page.' }, 400);
  const page = Number(rawPage);
  const query = (context.req.query('q') || '').trim();
  if (query.length > 100) return context.json({ error: 'Search is too long.' }, 400);
  const filter: Filter<ContactDocument> = {};
  if (status && status !== 'all') filter.status = status as ContactDocument['status'];
  if (query) {
    const search = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ name: search }, { email: search }, { subject: search }, { message: search }];
  }
  return withDb(context.env, async db => {
    const collection = db.collection<ContactDocument>('contacts');
    const [contacts, total, groups] = await Promise.all([
      collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).maxTimeMS(5000).toArray(),
      collection.countDocuments(filter, { maxTimeMS: 5000 }),
      collection.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }], { maxTimeMS: 5000 }).toArray(),
    ]);
    const counts = { new: 0, read: 0, archived: 0, total: 0 };
    for (const group of groups) {
      if (group._id === 'new' || group._id === 'read' || group._id === 'archived') counts[group._id] = group.count;
      counts.total += group.count;
    }
    return context.json({ contacts: contacts.map(serialize), pagination: { page, limit: 20, total, pages: Math.max(1, Math.ceil(total / 20)) }, counts });
  });
});

app.patch('/api/admin/contacts/:id', async context => {
  const id = context.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return context.json({ error: 'Message not found.' }, 404);
  const parsed = statusSchema.safeParse(await readJson(context.req.raw, 1000));
  if (!parsed.success) return context.json({ error: 'Choose new, read, or archived.' }, 400);
  return withDb(context.env, async db => {
    const contact = await db.collection<ContactDocument>('contacts').findOneAndUpdate(
      { _id: new ObjectId(id) }, { $set: { status: parsed.data.status, updatedAt: new Date() } }, { returnDocument: 'after' },
    );
    if (!contact) return context.json({ error: 'Message not found.' }, 404);
    return context.json({ ok: true, contact: serialize(contact) });
  });
});

app.post('/api/admin/contacts/:id/retry-email', async context => {
  const id = context.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return context.json({ error: 'Message not found.' }, 404);
  return withDb(context.env, async db => {
    const contact = await db.collection<ContactDocument>('contacts').findOne({ _id: new ObjectId(id) });
    if (!contact) return context.json({ error: 'Message not found.' }, 404);
    if (contact.notification.status === 'sent') return context.json({ ok: true, notification: 'sent' });
    if (contact.notification.lastAttemptAt && Date.now() - contact.notification.lastAttemptAt.getTime() < 60000) {
      context.header('Retry-After', '60');
      return context.json({ error: 'Please wait a minute before retrying this email.' }, 429);
    }
    const notification = await notifyContact(db, contact._id, context.env);
    return context.json({ ok: notification === 'sent', notification }, notification === 'sent' ? 200 : 502);
  });
});

app.notFound(context => context.json({ error: 'Not found.' }, 404));
app.onError((error, context) => {
  if (error instanceof InputError) return context.json({ error: error.message }, error.status);
  console.error('Portfolio API request failed.');
  return context.json({ error: 'This is temporarily unavailable. Please try again, or email heresuryanshsingh@gmail.com.' }, 503);
});

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await retryPendingNotifications(env);
  },
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.suryansh.lol') return Response.redirect(`https://suryansh.lol${url.pathname}${url.search}`, 308);
    if (url.pathname.startsWith('/api/')) return app.fetch(request, env, context);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
