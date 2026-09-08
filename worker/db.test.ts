import { describe, expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import { allowContact } from './db';

function databaseWithCounts(shortCount: number, dailyCount: number): Db {
  const findOneAndUpdate = vi.fn()
    .mockResolvedValueOnce({ count: shortCount })
    .mockResolvedValueOnce({ count: dailyCount });
  return { collection: () => ({ findOneAndUpdate }) } as unknown as Db;
}

describe('contact rate-limit reset time', () => {
  it('returns the exact daily reset when both windows are exhausted', async () => {
    const now = Date.UTC(2026, 8, 8, 12, 34, 56, 500);
    expect(await allowContact(databaseWithCounts(4, 11), 'digest', now)).toEqual({
      allowed: false, retryAfter: 41104,
    });
  });
  it('returns the remaining short bucket time when the daily budget is available', async () => {
    const now = Date.UTC(2026, 8, 8, 12, 34, 56, 500);
    expect(await allowContact(databaseWithCounts(4, 8), 'digest', now)).toEqual({
      allowed: false, retryAfter: 304,
    });
  });
  it('allows the limits themselves and never returns a zero wait for a rejection', async () => {
    const now = Date.UTC(2026, 8, 8, 23, 59, 59, 999);
    expect(await allowContact(databaseWithCounts(3, 10), 'digest', now)).toEqual({ allowed: true, retryAfter: 0 });
    expect(await allowContact(databaseWithCounts(4, 11), 'digest', now)).toEqual({ allowed: false, retryAfter: 1 });
  });
});
