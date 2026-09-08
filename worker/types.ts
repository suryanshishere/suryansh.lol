import type { ObjectId } from 'mongodb';

export interface Env {
  ASSETS: Fetcher;
  MONGODB_URI: string;
  MONGODB_DB: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ADMIN_EMAIL: string;
  SITE_URL: string;
  APP_ENV: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  MAIL_FROM: string;
}

export type ContactStatus = 'new' | 'read' | 'archived';
export interface ContactDocument {
  _id: ObjectId;
  submissionId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
  notification: {
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
    lastAttemptAt?: Date;
    sentAt?: Date;
    leaseUntil?: Date;
    leaseToken?: string;
  };
}

export interface AdminSession {
  email: string;
  name: string;
  picture?: string;
  csrfToken: string;
}
