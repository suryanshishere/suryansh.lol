import type { Filter } from 'mongodb';
import { withDb } from './db';
import { notifyContact } from './mail';
import type { ContactDocument, Env } from './types';

const MAX_AUTOMATIC_ATTEMPTS = 5;
const BATCH_SIZE = 5;
const BACKOFF_MS = 15 * 60 * 1000;

function eligibleNotifications(now: Date): Filter<ContactDocument> {
  const due: Filter<ContactDocument>[] = [{
    'notification.attempts': 0,
    createdAt: { $lte: new Date(now.getTime() - BACKOFF_MS) },
  }];
  // At most five sends in total, including the initial contact notification.
  // Retry delays after attempts 1–4 are 15, 30, 60, and 120 minutes. The admin
  // endpoint does not pass this eligibility filter, so manual retry stays open.
  for (let attempts = 1; attempts < MAX_AUTOMATIC_ATTEMPTS; attempts++) {
    due.push({
      'notification.attempts': attempts,
      'notification.lastAttemptAt': { $lte: new Date(now.getTime() - BACKOFF_MS * 2 ** (attempts - 1)) },
    });
  }
  return {
    'notification.status': { $in: ['pending', 'failed'] },
    'notification.attempts': { $lt: MAX_AUTOMATIC_ATTEMPTS },
    $and: [
      { $or: [{ 'notification.leaseUntil': { $exists: false } }, { 'notification.leaseUntil': { $lte: now } }] },
      { $or: due },
    ],
  };
}

/** Safe for a 15-minute cron trigger; contact data and provider errors never enter logs. */
export async function retryPendingNotifications(env: Env, now = new Date()): Promise<void> {
  try {
    await withDb(env, async db => {
      const eligibility = eligibleNotifications(now);
      const contacts = await db.collection<ContactDocument>('contacts')
        .find(eligibility, { projection: { _id: 1 } })
        .sort({ createdAt: 1 }).limit(BATCH_SIZE).maxTimeMS(5000).toArray();
      // Sequential sends bound SMTP connections and allow one failure to recover
      // independently without preventing the rest of the capped batch.
      for (const contact of contacts) {
        try { await notifyContact(db, contact._id, env, { eligibility }); }
        catch { console.error('Portfolio scheduled notification retry failed.'); }
      }
    });
  } catch { console.error('Portfolio notification retry batch unavailable.'); }
}
