import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import type { ContactDocument, Env } from './types';

const mocks = vi.hoisted(() => ({ withDb: vi.fn(), notifyContact: vi.fn() }));
vi.mock('./db', () => ({ withDb: mocks.withDb }));
vi.mock('./mail', () => ({ notifyContact: mocks.notifyContact }));
import { retryPendingNotifications } from './retries';

const env = {} as Env;
const now = new Date('2026-09-08T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000);
let documents: ContactDocument[];
let selectedFilter: Record<string, unknown>;

function contact(attempts: number, minutes: number, status: ContactDocument['notification']['status'] = 'failed'): ContactDocument {
  return {
    _id: new ObjectId(), submissionId: crypto.randomUUID(), name: 'Visitor', email: 'visitor@example.com',
    subject: 'Project', message: 'A saved portfolio contact message.', status: 'new',
    createdAt: minutesAgo(300), updatedAt: minutesAgo(300),
    notification: { status, attempts, ...(attempts ? { lastAttemptAt: minutesAgo(minutes) } : {}) },
  };
}

// Apply the Mongo query's comparison operators to fixtures, independently of
// the retry policy, so tests exercise which messages a batch actually selects.
function matches(document: ContactDocument, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return (value as Record<string, unknown>[]).every(part => matches(document, part));
    if (key === '$or') return (value as Record<string, unknown>[]).some(part => matches(document, part));
    const actual = key.split('.').reduce<unknown>((part, field) => (part as Record<string, unknown> | undefined)?.[field], document);
    if (value === null || typeof value !== 'object' || value instanceof Date) return actual === value;
    return Object.entries(value).every(([operator, expected]) => {
      if (operator === '$exists') return (actual !== undefined) === expected;
      if (operator === '$in') return (expected as unknown[]).includes(actual);
      if (actual === undefined) return false;
      if (operator === '$lt') return Number(actual) < Number(expected);
      if (operator === '$lte') return Number(actual) <= Number(expected);
      throw new Error(`Unsupported test comparison: ${operator}`);
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  documents = [];
  mocks.notifyContact.mockResolvedValue('sent');
  mocks.withDb.mockImplementation(async (_env, operation) => operation({
    collection: () => ({ find: (filter: Record<string, unknown>) => {
      selectedFilter = filter;
      let limit = Infinity;
      const cursor = {
        sort: () => cursor,
        limit: (value: number) => { limit = value; return cursor; },
        maxTimeMS: () => cursor,
        toArray: async () => documents.filter(document => matches(document, filter)).slice(0, limit),
      };
      return cursor;
    } }),
  }));
});

describe('automatic notification recovery', () => {
  it('selects only due unsent messages below the attempt cap and without an active lease', async () => {
    const due = contact(1, 15);
    const expiredLease = contact(2, 31, 'pending');
    expiredLease.notification.leaseUntil = minutesAgo(1);
    const activeLease = contact(1, 30);
    activeLease.notification.leaseUntil = minutesAgo(-1);
    documents = [contact(1, 14), contact(1, 60, 'sent'), contact(5, 300), activeLease, due, expiredLease];

    await retryPendingNotifications(env, now);

    expect(mocks.notifyContact.mock.calls.map(call => call[1])).toEqual([due._id, expiredLease._id]);
    expect(mocks.notifyContact.mock.calls[0][3]).toEqual({ eligibility: selectedFilter });
  });

  it('backs off longer after each failed attempt, while recovering never-attempted durable messages', async () => {
    const neverTried = contact(0, 0, 'pending');
    const tooNew = contact(0, 0, 'pending');
    tooNew.createdAt = minutesAgo(1);
    const due = [neverTried, contact(2, 30), contact(3, 60), contact(4, 120)];
    documents = [tooNew, contact(2, 29), contact(3, 59), contact(4, 119), ...due];

    await retryPendingNotifications(env, now);

    expect(mocks.notifyContact.mock.calls.map(call => call[1])).toEqual(due.map(document => document._id));
  });

  it('caps each cron batch at five contacts', async () => {
    documents = Array.from({ length: 8 }, () => contact(1, 30));
    await retryPendingNotifications(env, now);
    expect(mocks.notifyContact).toHaveBeenCalledTimes(5);
  });

  it('does no SMTP work for an empty due batch', async () => {
    await retryPendingNotifications(env, now);
    expect(mocks.notifyContact).not.toHaveBeenCalled();
  });

  it('continues the batch after an individual failure without logging private data', async () => {
    documents = [contact(1, 30), contact(1, 30)];
    mocks.notifyContact.mockRejectedValueOnce(new Error('visitor@example.com secret SMTP response'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await retryPendingNotifications(env, now);
    expect(mocks.notifyContact).toHaveBeenCalledTimes(2);
    expect(log.mock.calls).toEqual([['Portfolio scheduled notification retry failed.']]);
    log.mockRestore();
  });

  it('resolves safely when the database is unavailable', async () => {
    mocks.withDb.mockRejectedValue(new Error('private connection string'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(retryPendingNotifications(env, now)).resolves.toBeUndefined();
    expect(log.mock.calls).toEqual([['Portfolio notification retry batch unavailable.']]);
    log.mockRestore();
  });
});
