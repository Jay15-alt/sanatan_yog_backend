// =============================================================
// src/services/volunteerService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { Volunteer, StaffSalary, CreateVolunteerDTO } from '../types';
import { ApiError } from '../utils/response';
import { TeamService } from './organizationService';

export class VolunteerService {

  static async create(dto: CreateVolunteerDTO, createdBy: number): Promise<Volunteer> {
    // Validate team
    const team = await TeamService.findById(dto.team_id);
    if (!team) throw new ApiError('Team not found.', 404);

    // STAFF must have a salary
    if (dto.volunteer_type === 'STAFF' && (dto.monthly_salary == null || dto.monthly_salary <= 0)) {
      throw new ApiError('Staff volunteers require a positive monthly_salary.', 400);
    }

    // GUEST must have a managing shakha
    if (dto.volunteer_type === 'GUEST' && !dto.shakha_id) {
      throw new ApiError('Guest volunteers must be assigned a managing Shakha.', 400);
    }

    const [res] = await pool.execute(
      `INSERT INTO volunteers (user_id, team_id, shakha_id, volunteer_type, monthly_salary, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.user_id,
        dto.team_id,
        dto.shakha_id ?? null,
        dto.volunteer_type,
        dto.monthly_salary ?? null,
        createdBy,
      ],
    );
    return (await VolunteerService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Volunteer | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM volunteers WHERE id = ?', [id]);
    return (rows as Volunteer[])[0] ?? null;
  }

  static async findByUserId(userId: number): Promise<Volunteer | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM volunteers WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId],
    );
    return (rows as Volunteer[])[0] ?? null;
  }

  static async findByTeam(teamId: number): Promise<Volunteer[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM volunteers WHERE team_id = ? AND is_active = 1', [teamId],
    );
    return rows as Volunteer[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE volunteers SET is_active = 0 WHERE id = ?', [id]);
  }

  // ─── Salary helpers (STAFF only) ──────────────────────────

  /**
   * Generate monthly salary record for a STAFF volunteer.
   * payMonth = first day of the target month (e.g. 2025-02-01).
   */
  static async createSalaryRecord(volunteerId: number, payMonth: Date): Promise<StaffSalary> {
    const vol = await VolunteerService.findById(volunteerId);
    if (!vol) throw new ApiError('Volunteer not found.', 404);
    if (vol.volunteer_type !== 'STAFF') throw new ApiError('Salary applies to STAFF only.', 400);
    if (!vol.monthly_salary) throw new ApiError('Monthly salary not configured.', 400);

    const [res] = await pool.execute(
      `INSERT INTO staff_salaries (volunteer_id, pay_month, amount) VALUES (?, ?, ?)`,
      [volunteerId, payMonth, vol.monthly_salary],
    );
    return (await VolunteerService.getSalary((res as { insertId: number }).insertId))!;
  }

  static async getSalary(id: number): Promise<StaffSalary | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM staff_salaries WHERE id = ?', [id]);
    return (rows as StaffSalary[])[0] ?? null;
  }

  static async markSalaryPaid(id: number): Promise<StaffSalary> {
    await pool.execute(
      `UPDATE staff_salaries SET status = 'PAID', paid_at = NOW() WHERE id = ?`, [id],
    );
    return (await VolunteerService.getSalary(id))!;
  }

  static async getSalariesByVolunteer(volunteerId: number): Promise<StaffSalary[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM staff_salaries WHERE volunteer_id = ? ORDER BY pay_month DESC', [volunteerId],
    );
    return rows as StaffSalary[];
  }
}
