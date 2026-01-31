// =============================================================
// src/services/organizationService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Peeth, Shakha, SubShakha, Team,
  CreatePeethDTO, CreateShakhaDTO, CreateSubShakhaDTO, CreateTeamDTO,
} from '../types';
import { ApiError } from '../utils/response';

// ─── PEETH ──────────────────────────────────────────────────

export class PeethService {
  static async create(dto: CreatePeethDTO, createdBy: number): Promise<Peeth> {
    const [res] = await pool.execute(
      `INSERT INTO peeths (name, user_id, created_by) VALUES (?, ?, ?)`,
      [dto.name, dto.user_id, createdBy],
    );
    return (await PeethService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Peeth | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM peeths WHERE id = ?', [id]);
    const peeths = rows as Peeth[];
    return peeths[0] ?? null;
  }

  static async findAll(activeOnly = true): Promise<Peeth[]> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM peeths ${where} ORDER BY name`);
    return rows as Peeth[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE peeths SET is_active = 0 WHERE id = ?', [id]);
  }
}

// ─── SHAKHA ─────────────────────────────────────────────────

export class ShakhaService {
  static async create(dto: CreateShakhaDTO, createdBy: number): Promise<Shakha> {
    // Verify peeth exists
    const peeth = await PeethService.findById(dto.peeth_id);
    if (!peeth) throw new ApiError('Peeth not found.', 404);

    const [res] = await pool.execute(
      `INSERT INTO shakhas (peeth_id, name, user_id, created_by) VALUES (?, ?, ?, ?)`,
      [dto.peeth_id, dto.name, dto.user_id, createdBy],
    );
    return (await ShakhaService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Shakha | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM shakhas WHERE id = ?', [id]);
    return (rows as Shakha[])[0] ?? null;
  }

  static async findByPeeth(peethId: number, activeOnly = true): Promise<Shakha[]> {
    const where = activeOnly ? 'AND is_active = 1' : '';
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM shakhas WHERE peeth_id = ? ${where} ORDER BY name`,
      [peethId],
    );
    return rows as Shakha[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE shakhas SET is_active = 0 WHERE id = ?', [id]);
  }
}

// ─── SUB-SHAKHA ─────────────────────────────────────────────

export class SubShakhaService {
  static async create(dto: CreateSubShakhaDTO, createdBy: number): Promise<SubShakha> {
    const shakha = await ShakhaService.findById(dto.shakha_id);
    if (!shakha) throw new ApiError('Shakha not found.', 404);

    const [res] = await pool.execute(
      `INSERT INTO sub_shakhas (shakha_id, name, user_id, created_by) VALUES (?, ?, ?, ?)`,
      [dto.shakha_id, dto.name, dto.user_id, createdBy],
    );
    return (await SubShakhaService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<SubShakha | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM sub_shakhas WHERE id = ?', [id]);
    return (rows as SubShakha[])[0] ?? null;
  }

  static async findByShakha(shakhaId: number, activeOnly = true): Promise<SubShakha[]> {
    const where = activeOnly ? 'AND is_active = 1' : '';
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sub_shakhas WHERE shakha_id = ? ${where} ORDER BY name`,
      [shakhaId],
    );
    return rows as SubShakha[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE sub_shakhas SET is_active = 0 WHERE id = ?', [id]);
  }
}

// ─── TEAM ───────────────────────────────────────────────────

export class TeamService {
  static async create(dto: CreateTeamDTO, createdBy: number): Promise<Team> {
    if (!dto.shakha_id && !dto.sub_shakha_id) {
      throw new ApiError('Team must belong to a Shakha or SubShakha.', 400);
    }
    if (dto.shakha_id) {
      const s = await ShakhaService.findById(dto.shakha_id);
      if (!s) throw new ApiError('Shakha not found.', 404);
    }
    if (dto.sub_shakha_id) {
      const ss = await SubShakhaService.findById(dto.sub_shakha_id);
      if (!ss) throw new ApiError('SubShakha not found.', 404);
    }

    const [res] = await pool.execute(
      `INSERT INTO teams (shakha_id, sub_shakha_id, name, created_by) VALUES (?, ?, ?, ?)`,
      [dto.shakha_id ?? null, dto.sub_shakha_id ?? null, dto.name, createdBy],
    );
    return (await TeamService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Team | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM teams WHERE id = ?', [id]);
    return (rows as Team[])[0] ?? null;
  }

  static async findByShakha(shakhaId: number): Promise<Team[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM teams WHERE shakha_id = ? AND is_active = 1', [shakhaId],
    );
    return rows as Team[];
  }

  static async findBySubShakha(subShakhaId: number): Promise<Team[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM teams WHERE sub_shakha_id = ? AND is_active = 1', [subShakhaId],
    );
    return rows as Team[];
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE teams SET is_active = 0 WHERE id = ?', [id]);
  }
}
