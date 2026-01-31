// =============================================================
// src/services/commissionService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Commission,
  CommissionSlab,
  Donation,
  CreateCommissionSlabDTO,
} from '../types';
import { ApiError } from '../utils/response';

export class CommissionService {

  // ─── Slab management ────────────────────────────────────────

  static async createSlab(dto: CreateCommissionSlabDTO, createdBy: number): Promise<CommissionSlab> {
    const [res] = await pool.execute(
      `INSERT INTO commission_slabs
       (shakha_id, min_amount, max_amount, commission_type, commission_value, applies_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.shakha_id ?? null,
        dto.min_amount,
        dto.max_amount,
        dto.commission_type,
        dto.commission_value,
        dto.applies_to,
        createdBy,
      ],
    );
    return (await CommissionService.findSlabById((res as { insertId: number }).insertId))!;
  }

  static async findSlabById(id: number): Promise<CommissionSlab | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM commission_slabs WHERE id = ?', [id],
    );
    return (rows as CommissionSlab[])[0] ?? null;
  }

  static async getAllSlabs(shakhaId?: number): Promise<CommissionSlab[]> {
    // Returns shakha-specific slabs first, falling back to global (NULL)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM commission_slabs
       WHERE is_active = 1 AND (shakha_id = ? OR shakha_id IS NULL)
       ORDER BY shakha_id IS NULL, min_amount`,
      [shakhaId ?? null],
    );
    return rows as CommissionSlab[];
  }

  // ─── Auto-calculation ───────────────────────────────────────

  /**
   * Given a donation, find the volunteer's type.
   * If FIELD_WORKER → look up the matching slab and insert a commission row.
   * STAFF volunteers can optionally earn commission too (configurable),
   * but per the doc default, only Field Workers get auto-commission.
   */
  static async calculateForDonation(donation: Donation): Promise<Commission | null> {
    // Only Field Workers get commission by default
    const [volRows] = await pool.execute<RowDataPacket[]>(
      'SELECT volunteer_type, team_id FROM volunteers WHERE id = ?',
      [donation.volunteer_id],
    );
    const vol = (volRows as { volunteer_type: string; team_id: number }[])[0];
    if (!vol || vol.volunteer_type !== 'FIELD_WORKER') return null;

    const donatedAmount = donation.amount;
    if (!donatedAmount || donatedAmount <= 0) return null;

    // Determine applies_to based on donation type
    const [typeRow] = await pool.execute<RowDataPacket[]>(
      'SELECT name FROM donation_types WHERE id = ?', [donation.donation_type_id],
    );
    const typeRowCast = typeRow as { name: string }[];
    const appliesTo = typeRowCast[0]?.name === 'RICE_GRAIN' ? 'RICE_GRAIN' : 'AMOUNT';

    // Find the volunteer's shakha (via team)
    const [teamRow] = await pool.execute<RowDataPacket[]>(
      'SELECT shakha_id FROM teams WHERE id = ?', [vol.team_id],
    );
    const shakhaId = (teamRow as { shakha_id: number | null }[])[0]?.shakha_id ?? null;

    // Slab lookup: prefer shakha-specific, fallback to global
    const slab = await CommissionService.findMatchingSlab(donatedAmount, appliesTo, shakhaId);
    if (!slab) return null;

    // Calculate
    const commissionAmount =
      slab.commission_type === 'FIXED'
        ? slab.commission_value
        : parseFloat(((donatedAmount * slab.commission_value) / 100).toFixed(2));

    const [res] = await pool.execute(
      `INSERT INTO commissions (donation_id, volunteer_id, slab_id, calculated_amount)
       VALUES (?, ?, ?, ?)`,
      [donation.id, donation.volunteer_id, slab.id, commissionAmount],
    );
    return CommissionService.findById((res as { insertId: number }).insertId)!;
  }

  /** Find the first active slab that covers the given amount */
  private static async findMatchingSlab(
    amount: number,
    appliesTo: 'AMOUNT' | 'RICE_GRAIN',
    shakhaId: number | null,
  ): Promise<CommissionSlab | null> {
    // Try shakha-specific first
    if (shakhaId) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM commission_slabs
         WHERE shakha_id = ? AND applies_to = ? AND is_active = 1
           AND min_amount <= ? AND max_amount >= ?
         ORDER BY min_amount LIMIT 1`,
        [shakhaId, appliesTo, amount, amount],
      );
      if ((rows as CommissionSlab[])[0]) return (rows as CommissionSlab[])[0];
    }
    // Fallback to global
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM commission_slabs
       WHERE shakha_id IS NULL AND applies_to = ? AND is_active = 1
         AND min_amount <= ? AND max_amount >= ?
       ORDER BY min_amount LIMIT 1`,
      [appliesTo, amount, amount],
    );
    return (rows as CommissionSlab[])[0] ?? null;
  }

  // ─── Approve / Reject / Pay ─────────────────────────────────

  static async findById(id: number): Promise<Commission | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM commissions WHERE id = ?', [id]);
    return (rows as Commission[])[0] ?? null;
  }

  static async findByVolunteer(volunteerId: number): Promise<Commission[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM commissions WHERE volunteer_id = ? ORDER BY created_at DESC',
      [volunteerId],
    );
    return rows as Commission[];
  }

  static async approve(id: number, approvedBy: number): Promise<Commission> {
    const comm = await CommissionService.findById(id);
    if (!comm) throw new ApiError('Commission not found.', 404);
    if (comm.status !== 'PENDING') throw new ApiError('Commission is not in PENDING state.', 400);

    await pool.execute(
      `UPDATE commissions SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [approvedBy, id],
    );
    return (await CommissionService.findById(id))!;
  }

  static async reject(id: number, approvedBy: number): Promise<Commission> {
    const comm = await CommissionService.findById(id);
    if (!comm) throw new ApiError('Commission not found.', 404);
    if (comm.status !== 'PENDING') throw new ApiError('Commission is not in PENDING state.', 400);

    await pool.execute(
      `UPDATE commissions SET status = 'REJECTED', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [approvedBy, id],
    );
    return (await CommissionService.findById(id))!;
  }

  static async markPaid(id: number): Promise<Commission> {
    const comm = await CommissionService.findById(id);
    if (!comm) throw new ApiError('Commission not found.', 404);
    if (comm.status !== 'APPROVED') throw new ApiError('Commission must be APPROVED before payment.', 400);

    await pool.execute(
      `UPDATE commissions SET status = 'PAID', paid_at = NOW() WHERE id = ?`, [id],
    );
    return (await CommissionService.findById(id))!;
  }
}
