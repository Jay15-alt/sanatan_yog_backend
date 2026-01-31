// =============================================================
// src/utils/helpers.ts
// =============================================================

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/** Generate a new unique-id for users */
export function generateUniqueId(): string {
  return uuidv4();
}

/** Generate a 6-digit OTP string */
export function generateOtp(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/** Hash a plain OTP (or any short secret) */
export async function hashOtp(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Compare plain OTP against stored hash */
export async function compareOtp(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/** OTP expiry: now + N minutes */
export function otpExpiresAt(minutes: number = 10): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** Generate a unique receipt number: RCP-<timestamp>-<uuid4 first 8> */
export function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `RCP-${ts}-${uid}`;
}

/** Generate a QR-code token for events */
export function generateQrToken(): string {
  return uuidv4();
}

/** Safe parseInt with fallback */
export function safeInt(value: unknown, fallback = 0): number {
  const n = parseInt(String(value), 10);
  return isNaN(n) ? fallback : n;
}
