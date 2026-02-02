// =============================================================
// src/services/adminService.ts
// Operates exclusively on the `admins` table.
// Password-based auth, no OTP involvement whatsoever.
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { Admin, AdminRegisterDTO, AdminLoginDTO } from '../types';
import { ApiError } from '../utils/response';
import bcrypt from 'bcryptjs';

export class AdminService {

  // ─── Lookups ────────────────────────────────────────────────

  static async findById(id: number): Promise<Admin | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM admins WHERE id = ?', [id],
    );
    const admins = rows as Admin[];
    return admins[0] ?? null;
  }

  static async findByEmail(email: string): Promise<Admin | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM admins WHERE email = ?', [email.toLowerCase()],
    );
    const admins = rows as Admin[];
    return admins[0] ?? null;
  }

  static async findAll(): Promise<Admin[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM admins ORDER BY created_at',
    );
    return rows as Admin[];
  }

  // ─── Register ───────────────────────────────────────────────
  /**
   * Create a new admin / sub-admin.
   * Only an existing ADMIN can call this (enforced by the controller's roleGuard).
   */
  static async register(dto: AdminRegisterDTO): Promise<Admin> {
    if (!dto.email || !dto.password || !dto.name) {
      throw new ApiError('email, password, and name are required.', 400);
    }
    if (dto.password.length < 6) {
      throw new ApiError('Password must be at least 6 characters.', 400);
    }

    const existing = await AdminService.findByEmail(dto.email);
    if (existing) throw new ApiError('An admin with this email already exists.', 409);

    const hash = await bcrypt.hash(dto.password, 10);
    const role = dto.role ?? 'SUBADMIN';   // safe default

    const [res] = await pool.execute(
      'INSERT INTO admins (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [dto.email.toLowerCase(), hash, dto.name, role],
    );

    return (await AdminService.findById((res as { insertId: number }).insertId))!;
  }

  // ─── Login ──────────────────────────────────────────────────
  /**
   * Verify email + password.  Returns the admin row on success.
   * Throws 401 on any mismatch so the caller cannot distinguish
   * "unknown email" from "wrong password".
   */
  static async login(dto: AdminLoginDTO): Promise<Admin> {
    if (!dto.email || !dto.password) {
      throw new ApiError('email and password are required.', 400);
    }

    const admin = await AdminService.findByEmail(dto.email);
    if (!admin || !admin.is_active) {
      throw new ApiError('Invalid email or password.', 401);
    }

    const match = await bcrypt.compare(dto.password, admin.password_hash);
    if (!match) {
      throw new ApiError('Invalid email or password.', 401);
    }

    return admin;
  }

  // ─── Deactivate ─────────────────────────────────────────────

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE admins SET is_active = 0 WHERE id = ?', [id]);
  }

  // ─── Activate / Role update ─────────────────────────────────

  static async activate(id: number): Promise<void> {
    await pool.execute('UPDATE admins SET is_active = 1 WHERE id = ?', [id]);
  }

  static async updateRole(id: number, role: 'ADMIN' | 'SUBADMIN'): Promise<Admin> {
    await pool.execute('UPDATE admins SET role = ? WHERE id = ?', [role, id]);
    return (await AdminService.findById(id))!;
  }
}
