// =============================================================
// src/services/workService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Work,
  WorkExpense,
  CreateWorkDTO,
  UpdateWorkDTO,
} from '../types';
import { ApiError } from '../utils/response';

export class WorkService {

  static async create(dto: CreateWorkDTO, createdBy: number): Promise<Work> {
    const [res] = await pool.execute(
      `INSERT INTO works (title, description, budget, shakha_id, sub_shakha_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.title,
        dto.description ?? null,
        dto.budget ?? null,
        dto.shakha_id ?? null,
        dto.sub_shakha_id ?? null,
        createdBy,
      ],
    );
    return (await WorkService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Work | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM works WHERE id = ?', [id]);
    return (rows as Work[])[0] ?? null;
  }

  static async findAll(statusFilter?: string): Promise<Work[]> {
    const where = statusFilter ? 'WHERE status = ?' : '';
    const params = statusFilter ? [statusFilter] : [];
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM works ${where} ORDER BY created_at DESC`, params,
    );
    return rows as Work[];
  }

  static async findByShakha(shakhaId: number): Promise<Work[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM works WHERE shakha_id = ? ORDER BY created_at DESC', [shakhaId],
    );
    return rows as Work[];
  }

  /** Transition status following the Proposed → Ongoing → Completed flow */
  static async update(id: number, dto: UpdateWorkDTO, updatedBy: number): Promise<Work> {
    const work = await WorkService.findById(id);
    if (!work) throw new ApiError('Work not found.', 404);

    // Validate state transitions
    if (dto.status) {
      const allowed: Record<string, string[]> = {
        PROPOSED: ['ONGOING'],
        ONGOING:  ['COMPLETED'],
        COMPLETED: [],
      };
      if (!allowed[work.status]?.includes(dto.status)) {
        throw new ApiError(`Cannot transition from ${work.status} to ${dto.status}.`, 400);
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (dto.title != null)       { sets.push('title = ?');       params.push(dto.title); }
    if (dto.description != null) { sets.push('description = ?'); params.push(dto.description); }
    if (dto.budget != null)      { sets.push('budget = ?');      params.push(dto.budget); }
    if (dto.status) {
      sets.push('status = ?');
      params.push(dto.status);
      if (dto.status === 'ONGOING') {
        sets.push('started_at = NOW()');
        sets.push('approved_by = ?');
        params.push(updatedBy);
      }
      if (dto.status === 'COMPLETED') {
        sets.push('completed_at = NOW()');
        // Recalculate actual_expense as SUM of work_expenses
        const [expRow] = await pool.execute<RowDataPacket[]>(
          'SELECT COALESCE(SUM(amount), 0) as total FROM work_expenses WHERE work_id = ?', [id],
        );
        const totalRow = expRow as { total: number | null }[];
        sets.push('actual_expense = ?');
        params.push(totalRow[0].total);
      }
    }

    if (sets.length === 0) return work;

    sets.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(`UPDATE works SET ${sets.join(', ')} WHERE id = ?`, params);
    return (await WorkService.findById(id))!;
  }

  // ─── Expenses ─────────────────────────────────────────────

  static async addExpense(workId: number, description: string, amount: number, createdBy: number): Promise<WorkExpense> {
    const work = await WorkService.findById(workId);
    if (!work) throw new ApiError('Work not found.', 404);

    const [res] = await pool.execute(
      'INSERT INTO work_expenses (work_id, description, amount, created_by) VALUES (?, ?, ?, ?)',
      [workId, description, amount, createdBy],
    );
    return (await WorkService.getExpense((res as { insertId: number }).insertId))!;
  }

  static async getExpense(id: number): Promise<WorkExpense | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM work_expenses WHERE id = ?', [id]);
    return (rows as WorkExpense[])[0] ?? null;
  }

  static async getExpensesByWork(workId: number): Promise<WorkExpense[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM work_expenses WHERE work_id = ? ORDER BY created_at', [workId],
    );
    return rows as WorkExpense[];
  }
}
