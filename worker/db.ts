import { MongoClient, type Db } from 'mongodb';
import type { Env } from './types';

let indexesReady = false;

export async function withDb<T>(env: Env, operation: (db: Db) => Promise<T>): Promise<T> {
  if (!env.MONGODB_URI || !env.MONGODB_DB) throw new Error('Database is not configured.');
  // Workers sockets belong to the request which opens them. Never share a client
  // across requests; static pages and authentication do not open Mongo sockets.
  const client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 2,
    minPoolSize: 0,
    serverMonitoringMode: 'poll',
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 12000,
    waitQueueTimeoutMS: 5000,
    retryWrites: true,
  });
  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    if (!indexesReady) {
      await Promise.all([
        db.collection('contacts').createIndex({ submissionId: 1 }, { unique: true }),
        db.collection('contacts').createIndex({ createdAt: -1 }),
        db.collection('contacts').createIndex({ status: 1, createdAt: -1 }),
        db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]);
      indexesReady = true;
    }
    return await operation(db);
  } finally { await client.close(); }
}

export async function ipDigest(request: Request, secret: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'local-unknown';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

export async function allowContact(db: Db, digest: string, now = Date.now()): Promise<{ allowed: boolean; retryAfter: number }> {
  const windows = [
    { duration: 10 * 60 * 1000, limit: 3 },
    { duration: 24 * 60 * 60 * 1000, limit: 10 },
  ];
  // Each bucket increment is atomic, including simultaneous incoming requests.
  // Only a keyed digest is stored, and TTL removes buckets after their window.
  // Evaluate both windows so an exhausted daily bucket is not hidden by the
  // shorter limit. Rejected attempts count toward the abuse prevention budget.
  let retryAfter = 0;
  for (const window of windows) {
    const bucket = Math.floor(now / window.duration);
    const document = await db.collection<{ _id: string; count: number; expiresAt: Date }>('rate_limits').findOneAndUpdate(
      { _id: `${digest}:${window.duration}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * window.duration) } },
      { upsert: true, returnDocument: 'after' },
    );
    if (!document || document.count > window.limit) {
      const resetSeconds = Math.max(1, Math.ceil(((bucket + 1) * window.duration - now) / 1000));
      retryAfter = Math.max(retryAfter, resetSeconds);
    }
  }
  return { allowed: retryAfter === 0, retryAfter };
}
