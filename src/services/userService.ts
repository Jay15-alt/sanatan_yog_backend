// =============================================================
// src/services/userService.ts
// Handles the OTP-based login path shared by
// Peeth / Shakha / SubShakha / Volunteers / Contributors.
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  User,
  RoleName,
  OtpRequestDTO,
  OtpVerifyDTO,
} from '../types';
import {
  generateUniqueId,
  generateOtp,
  hashOtp,
  compareOtp,
  otpExpiresAt,
} from '../utils/helpers';
import { ApiError } from '../utils/response';

/** What resolveOrgRole returns after a successful OTP verify */
export interface OrgRoleContext {
  role: RoleName;
  peeth_id?: number;
  shakha_id?: number;
  sub_shakha_id?: number;
}

export class UserService {

  // ─── Basic lookups ──────────────────────────────────────────

  static async findById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?', [id],
    );
    const users = rows as User[];
    return users[0] ?? null;
  }

  static async findByContact(phone?: string, email?: string): Promise<User | null> {
    if (!phone && !email) return null;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (phone) { conditions.push('phone = ?'); params.push(phone); }
    if (email) { conditions.push('email = ?'); params.push(email); }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM users WHERE ${conditions.join(' OR ')} LIMIT 1`, params,
    );
    const users = rows as User[];
    return users[0] ?? null; 
  }

  // ─── OTP flow (shared login endpoint) ───────────────────────

  /**
   * Step 1 – Request OTP.
   * Creates user row if it doesn't exist (UNVERIFIED), then writes OTP + expiry.
   */
  static async requestOtp(dto: OtpRequestDTO): Promise<{ message: string }> {
    if (!dto.phone && !dto.email) {
      throw new ApiError('Provide phone or email.', 400);
    }

    let user = await UserService.findByContact(dto.phone, dto.email);

    if (!user) {
      const uniqueId = generateUniqueId();
      const [result] = await pool.execute(
        `INSERT INTO users (unique_id, email, phone, status) VALUES (?, ?, ?, 'UNVERIFIED')`,
        [uniqueId, dto.email ?? null, dto.phone ?? null],
      );
      user = await UserService.findById((result as { insertId: number }).insertId);
    }

    const otp       = generateOtp();
    const hashed    = await hashOtp(otp);
    const expires   = otpExpiresAt(parseInt(process.env.OTP_TTL_MINUTES || '10', 10));

    await pool.execute(
      'UPDATE users SET otp_hash = ?, otp_expires_at = ? WHERE id = ?',
      [hashed, expires, user!.id],
    );

    // TODO: send OTP via SMS / email provider
    console.log(`[OTP] User ${user!.id} → OTP: ${otp} (expires ${expires.toISOString()})`);

    return { message: 'OTP sent.' };
  }

  /**
   * Step 2 – Verify OTP.
   * Returns the user row on success; promotes UNVERIFIED → ACTIVE.
   */
  static async verifyOtp(dto: OtpVerifyDTO): Promise<User> {
    if (!dto.phone && !dto.email) {
      throw new ApiError('Provide phone or email.', 400);
    }

    const user = await UserService.findByContact(dto.phone, dto.email);
    if (!user) throw new ApiError('User not found.', 404);

    if (!user.otp_hash || !user.otp_expires_at) {
      throw new ApiError('No OTP requested. Request one first.', 400);
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      throw new ApiError('OTP expired.', 400);
    }

    const match = await compareOtp(dto.otp, user.otp_hash);
    if (!match) throw new ApiError('Invalid OTP.', 401);

    await pool.execute(
      `UPDATE users
       SET otp_hash = NULL,
           otp_expires_at = NULL,
           status = IF(status = 'UNVERIFIED', 'ACTIVE', status)
       WHERE id = ?`,
      [user.id],
    );

    return (await UserService.findById(user.id))!;
  }

  // ─── Org-role resolution ────────────────────────────────────
  /**
   * After OTP verify succeeds we need to know *what* this user is
   * inside the org hierarchy.  Walks peeths → shakhas → sub_shakhas
   * → volunteers in priority order and returns the first match.
   *
   * Priority: SubShakha > Shakha > Peeth > Volunteer > Contributor (default)
   */
  static async resolveOrgRole(userId: number): Promise<OrgRoleContext> {
    // 1. SubShakha owner?
    const [ssRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, shakha_id FROM sub_shakhas WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [userId],
    );
    const subShRows = ssRows as { id: number; shakha_id: number }[];
    if (subShRows[0]) {
      // Also fetch the parent shakha to get peeth_id
      const [shRow] = await pool.execute<RowDataPacket[]>(
        'SELECT peeth_id FROM shakhas WHERE id = ?', [subShRows[0].shakha_id],
      );
      const shakhaRows = shRow as { peeth_id: number }[];
      return {
        role: 'SUBSHAKHA',
        peeth_id: shakhaRows[0]?.peeth_id,
        shakha_id: subShRows[0].shakha_id,
        sub_shakha_id: subShRows[0].id,
      };
    }

    // 2. Shakha owner?
    const [shRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, peeth_id FROM shakhas WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [userId],
    );
    const shakhaRows = shRows as { id: number; peeth_id: number }[];
    if (shakhaRows[0]) {
      return {
        role: 'SHAKHA',
        peeth_id: shakhaRows[0].peeth_id,
        shakha_id: shakhaRows[0].id,
      };
    }

    // 3. Peeth owner?
    const [pRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM peeths WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [userId],
    );
    const peethRows = pRows as { id: number }[];
    if (peethRows[0]) {
      return { role: 'PEETH', peeth_id: peethRows[0].id };
    }

    // 4. Volunteer?
    const [vRows] = await pool.execute<RowDataPacket[]>(
      'SELECT volunteer_type FROM volunteers WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [userId],
    );
    const volRows = vRows as { volunteer_type: string }[];
    if (volRows[0]) {
      const volRole: RoleName =
        volRows[0].volunteer_type === 'STAFF'        ? 'STAFF_VOLUNTEER'  :
        volRows[0].volunteer_type === 'FIELD_WORKER' ? 'FIELD_WORKER'     :
                                                     'GUEST_VOLUNTEER';
      return { role: volRole };
    }

    // 5. Default — contributor
    return { role: 'CONTRIBUTOR' };
  }

  // ─── Direct user creation (volunteer direct-add flow) ───────

  static async create(
    email: string | null,
    phone: string | null,
    status: 'UNVERIFIED' | 'PENDING_PAN' = 'UNVERIFIED',
  ): Promise<User> {
    const uniqueId = generateUniqueId();
    const [result] = await pool.execute(
      'INSERT INTO users (unique_id, email, phone, status) VALUES (?, ?, ?, ?)',
      [uniqueId, email, phone, status],
    );
    return (await UserService.findById((result as { insertId: number }).insertId))!;
  }
}
