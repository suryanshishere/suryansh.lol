import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId, type Db } from 'mongodb';
import type { ContactDocument, Env } from './types';

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(), sendMail: vi.fn(), close: vi.fn(),
  findOneAndUpdate: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
import { notifyContact } from './mail';

const env = {
  ADMIN_EMAIL: 'admin@example.com', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587',
  SMTP_USER: 'sender@example.com', SMTP_PASS: 'test-secret', MAIL_FROM: 'sender@example.com',
  SITE_URL: 'https://suryansh.lol',
} as Env;
const contact: ContactDocument = {
  _id: new ObjectId(), submissionId: crypto.randomUUID(), name: 'Visitor', email: 'visitor@example.com',
  subject: 'A project idea', message: 'I would like to discuss a portfolio project.', status: 'new',
  createdAt: new Date('2026-09-08T10:00:00Z'), updatedAt: new Date('2026-09-08T10:00:00Z'),
  notification: { status: 'pending', attempts: 1 },
};
const db = { collection: () => mocks } as unknown as Db;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
  mocks.findOneAndUpdate.mockResolvedValue(contact);
  mocks.findOne.mockResolvedValue(contact);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.sendMail.mockResolvedValue({ accepted: [env.ADMIN_EMAIL] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('notification lease and send deadline', () => {
  it('sends to the owner, closes SMTP, and completes only its own lease', async () => {
    expect(await notifyContact(db, contact._id, env)).toBe('sent');
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({
      to: env.ADMIN_EMAIL, replyTo: { name: contact.name, address: contact.email },
      messageId: `<portfolio-${contact._id.toHexString()}@suryansh.lol>`,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const claim = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(claim['notification.leaseToken']).toEqual(expect.any(String));
    expect(claim['notification.leaseUntil'].getTime() - claim['notification.lastAttemptAt'].getTime()).toBe(90000);
    expect(mocks.updateOne.mock.calls[0][0]).toEqual({ _id: contact._id, 'notification.leaseToken': claim['notification.leaseToken'] });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('does not send when another sender already owns the lease', async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    expect(await notifyContact(db, contact._id, env)).toBe('pending');
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('rechecks automatic retry eligibility atomically but leaves manual retries uncapped', async () => {
    const eligibility = { 'notification.attempts': { $lt: 5 } };
    await notifyContact(db, contact._id, env, { eligibility });
    expect(mocks.findOneAndUpdate.mock.calls[0][0].$and).toEqual([eligibility]);
    await notifyContact(db, contact._id, env);
    expect(mocks.findOneAndUpdate.mock.calls[1][0]).not.toHaveProperty('$and');
  });

  it('preserves a newer successful result when an older lease cannot complete', async () => {
    mocks.sendMail.mockRejectedValue(new Error('private provider response'));
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    mocks.findOne.mockResolvedValue({ ...contact, notification: { status: 'sent', attempts: 2 } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await notifyContact(db, contact._id, env)).toBe('sent');
    expect(mocks.updateOne.mock.calls[0][0]).toHaveProperty('notification.leaseToken');
    expect(log.mock.calls).toEqual([['Portfolio notification delivery failed.', 'DELIVERY_ERROR']]);
  });

  it('stops a stalled SMTP send at 25 seconds and records failure for retry', async () => {
    vi.useFakeTimers();
    mocks.sendMail.mockReturnValue(new Promise(() => {}));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = notifyContact(db, contact._id, env);
    await vi.advanceTimersByTimeAsync(24999);
    expect(mocks.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe('failed');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.updateOne.mock.calls[0][1].$set['notification.status']).toBe('failed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
