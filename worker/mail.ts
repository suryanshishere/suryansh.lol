import nodemailer from 'nodemailer';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { ContactDocument, Env } from './types';

export async function notifyContact(
  db: Db,
  id: ObjectId,
  env: Env,
  options: { eligibility?: Filter<ContactDocument> } = {},
): Promise<'sent' | 'pending' | 'failed'> {
  const collection = db.collection<ContactDocument>('contacts');
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  // Check scheduled eligibility again when claiming the lease: another sender
  // may have changed the attempt count or backoff since the batch was selected.
  const contact = await collection.findOneAndUpdate({
    _id: id,
    'notification.status': { $ne: 'sent' },
    $or: [{ 'notification.leaseUntil': { $exists: false } }, { 'notification.leaseUntil': { $lte: now } }],
    ...(options.eligibility ? { $and: [options.eligibility] } : {}),
  }, {
    $set: { 'notification.leaseUntil': new Date(now.getTime() + 90000), 'notification.leaseToken': leaseToken, 'notification.lastAttemptAt': now },
    $inc: { 'notification.attempts': 1 },
  }, { returnDocument: 'after' });
  if (!contact) return (await collection.findOne({ _id: id }))?.notification.status === 'sent' ? 'sent' : 'pending';
  let status: 'sent' | 'failed' = 'failed';
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    requireTLS: Number(env.SMTP_PORT) !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    // Socket timeouts are inactivity limits. This separate total deadline keeps
    // slow SMTP conversations inside the lease and the visitor's request limit.
    const timeout = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error('Notification deadline exceeded.')), 25000);
    });
    const result = await Promise.race([transport.sendMail({
      from: { name: 'Suryansh · Portfolio', address: env.MAIL_FROM },
      to: env.ADMIN_EMAIL,
      replyTo: { name: contact.name, address: contact.email },
      subject: `[suryansh.lol] ${contact.subject}`,
      text: `New portfolio message\n\nFrom: ${contact.name} <${contact.email}>\nSubject: ${contact.subject}\n\n${contact.message}\n\nReceived: ${contact.createdAt.toISOString()}\nManage this message: ${env.SITE_URL}/admin/\nReference: ${contact._id.toHexString()}`,
      messageId: `<portfolio-${contact._id.toHexString()}@suryansh.lol>`,
      disableFileAccess: true, disableUrlAccess: true,
    }), timeout]);
    if (result.accepted?.length) status = 'sent';
  } catch (error) {
    // Never log credentials, submitted messages, or the SMTP server response.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const category = ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EAUTH', 'EENVELOPE', 'EMESSAGE', 'EDNS'].includes(code) ? code : 'DELIVERY_ERROR';
    const reason = error instanceof Error ? error.message : '';
    const safeReason = reason.replaceAll(env.SMTP_PASS, '[redacted]').replaceAll(env.SMTP_USER, '[sender]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[address]').slice(0, 250);
    console.error('Portfolio notification delivery failed.', category, safeReason);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
    transport.close();
  }
  // An old sender cannot overwrite a newer lease owner's result after expiry.
  const update = await collection.updateOne({ _id: id, 'notification.leaseToken': leaseToken }, {
    $set: { 'notification.status': status, ...(status === 'sent' ? { 'notification.sentAt': new Date() } : {}) },
    $unset: { 'notification.leaseUntil': '', 'notification.leaseToken': '' },
  });
  if (!update.matchedCount) return (await collection.findOne({ _id: id }))?.notification.status === 'sent' ? 'sent' : 'pending';
  return status;
}
