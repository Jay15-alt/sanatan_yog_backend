// =============================================================
// src/services/contributorService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Contributor,
  CreateContributorDTO,
  UploadPanDTO,
} from '../types';
import { ApiError } from '../utils/response';
import { UserService } from './userService';

export class ContributorService {

  // ─── Step 1: Volunteer adds contributor (no PAN) ───────────

  static async addByVolunteer(
    dto: CreateContributorDTO,
    volunteerId: number,
  ): Promise<Contributor> {
    // Create / fetch user with PENDING_PAN status
    let user = await UserService.findById(dto.user_id);
    if (!user) {
      // If user doesn't exist yet, create with PENDING_PAN
      user = await UserService.create(null, null, 'PENDING_PAN');
    }

    // Default category = General (id typically 1 from seed)
    const [catRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM contributor_categories WHERE name = 'General' LIMIT 1",
    );
    const categoryId = (catRows as { id: number }[])[0]?.id ?? 1;

    // Find the team of this volunteer
    const [volRows] = await pool.execute<RowDataPacket[]>(
      'SELECT team_id FROM volunteers WHERE id = ?', [volunteerId],
    );
    const teamId = (volRows as { team_id: number }[])[0]?.team_id ?? null;

    const [res] = await pool.execute(
      `INSERT INTO contributors
       (user_id, category_id, contributor_type, pan_status,
        gender, address_line1, address_line2, city, state, pincode,
        photo_face, photo_full, photo_house,
        geo_latitude, geo_longitude,
        added_by_volunteer, assigned_team_id)
       VALUES (?, ?, 'GENERAL', 'NOT_UPLOADED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        categoryId,
        dto.gender ?? null,
        dto.address_line1 ?? null,
        dto.address_line2 ?? null,
        dto.city ?? null,
        dto.state ?? null,
        dto.pincode ?? null,
        dto.photo_face ?? null,
        dto.photo_full ?? null,
        dto.photo_house ?? null,
        dto.geo_latitude ?? null,
        dto.geo_longitude ?? null,
        volunteerId,
        teamId,
      ],
    );
    return (await ContributorService.findById((res as { insertId: number }).insertId))!;
  }

  // ─── Step 2: PAN upload by contributor ──────────────────────

  static async uploadPan(contributorId: number, dto: UploadPanDTO): Promise<Contributor> {
    const contrib = await ContributorService.findById(contributorId);
    if (!contrib) throw new ApiError('Contributor not found.', 404);
    if (contrib.pan_status === 'VERIFIED') {
      throw new ApiError('PAN already verified.', 400);
    }

    await pool.execute(
      `UPDATE contributors SET pan_number = ?, pan_status = 'PENDING', updated_at = NOW() WHERE id = ?`,
      [dto.pan_number, contributorId],
    );
    return (await ContributorService.findById(contributorId))!;
  }

  // ─── Volunteer / Shakha verifies PAN ────────────────────────

  static async verifyPan(contributorId: number, approve: boolean): Promise<Contributor> {
    const newStatus = approve ? 'VERIFIED' : 'REJECTED';
    await pool.execute(
      `UPDATE contributors SET pan_status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, contributorId],
    );
    if (approve) {
      // Also mark the user as verified
      const contrib = await ContributorService.findById(contributorId);
      if (contrib) {
        await pool.execute(
          `UPDATE users SET is_verified = 1, status = 'ACTIVE' WHERE id = ?`,
          [contrib.user_id],
        );
      }
    }
    return (await ContributorService.findById(contributorId))!;
  }

  // ─── Upgrade contributor type (Shakha only) ────────────────

  static async upgradeType(
    contributorId: number,
    newType: 'TRUSTEE' | 'GRUHINI',
  ): Promise<Contributor> {
    const contrib = await ContributorService.findById(contributorId);
    if (!contrib) throw new ApiError('Contributor not found.', 404);

    if (newType === 'GRUHINI') {
      // Must be female
      if (contrib.gender !== 'FEMALE') {
        throw new ApiError('Only female contributors can be upgraded to Gruhini.', 400);
      }
      // One-per-family rule: check address match
      const [dupes] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM contributors
         WHERE contributor_type = 'GRUHINI'
           AND is_active = 1
           AND id != ?
           AND pincode IS NOT NULL
           AND pincode = ?
           AND address_line1 IS NOT NULL
           AND address_line1 = ?`,
        [contributorId, contrib.pincode, contrib.address_line1],
      );
      if ((dupes as { id: number }[]).length > 0) {
        throw new ApiError('A Gruhini already exists at this address. Only one per family is allowed.', 409);
      }
    }

    await pool.execute(
      `UPDATE contributors SET contributor_type = ?, updated_at = NOW() WHERE id = ?`,
      [newType, contributorId],
    );
    return (await ContributorService.findById(contributorId))!; 
  }

  // ─── Reassign contributor to another team ──────────────────

  static async reassignTeam(contributorId: number, newTeamId: number): Promise<Contributor> {
    const [teamRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM teams WHERE id = ? AND is_active = 1', [newTeamId],
    );
    if (!(teamRows as { id: number }[])[0]) throw new ApiError('Target team not found or inactive.', 404);

    await pool.execute(
      'UPDATE contributors SET assigned_team_id = ?, updated_at = NOW() WHERE id = ?',
      [newTeamId, contributorId],
    );
    return (await ContributorService.findById(contributorId))!;
  }

  // ─── Queries ────────────────────────────────────────────────

  static async findById(id: number): Promise<Contributor | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM contributors WHERE id = ?', [id]);
    return (rows as Contributor[])[0] ?? null;
  }

  static async findByUserId(userId: number): Promise<Contributor | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM contributors WHERE user_id = ? LIMIT 1', [userId],
    );
    return (rows as Contributor[])[0] ?? null;
  }

  static async findByTeam(teamId: number): Promise<Contributor[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM contributors WHERE assigned_team_id = ? AND is_active = 1', [teamId],
    );
    return rows as Contributor[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE contributors SET is_active = 0 WHERE id = ?', [id]);
  }
}
