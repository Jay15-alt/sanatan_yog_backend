// =============================================================
// src/services/eventService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Event,
  EventParticipant,
  Attendance,
  CreateEventDTO,
  RegisterParticipantDTO,
  MarkAttendanceDTO,
} from '../types';
import { ApiError } from '../utils/response';
import { generateQrToken } from '../utils/helpers';

// ─── Shape returned by the event-level attendance report ─────
export interface EventAttendanceReport {
  event_id: number;
  event_title: string;
  event_date: Date;
  total_registered: number;
  total_present: number;
  total_absent: number;
  attendees: {
    user_id: number;
    scan_time: Date | null;
    status: 'PRESENT' | 'ABSENT';
  }[];
}

export class EventService {

  // ─── CRUD ───────────────────────────────────────────────────

  static async create(dto: CreateEventDTO, createdBy: number): Promise<Event> {
    const qrToken = generateQrToken();

    const [res] = await pool.execute(
      `INSERT INTO events
       (title, description, category, event_date, location,
        qr_code_token, created_by, shakha_id, sub_shakha_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.title,
        dto.description ?? null,
        dto.category ?? null,
        new Date(dto.event_date),
        dto.location ?? null,
        qrToken,
        createdBy,
        dto.shakha_id ?? null,
        dto.sub_shakha_id ?? null,
      ],
    );
    return (await EventService.findById((res as { insertId: number }).insertId))!;
  }

  static async findById(id: number): Promise<Event | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM events WHERE id = ?', [id]);
    return (rows as Event[])[0] ?? null;
  }

  static async findByQrToken(token: string): Promise<Event | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM events WHERE qr_code_token = ? AND is_active = 1', [token],
    );
    return (rows as Event[])[0] ?? null;
  }

  static async findAll(activeOnly = true): Promise<Event[]> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM events ${where} ORDER BY event_date DESC`,
    );
    return rows as Event[];
  }

  /**
   * Edit an event.
   * Only the creator can edit, unless the caller is ADMIN / SUBADMIN
   * (enforced in the controller via role guard + ownership check).
   */
  static async update(id: number, updates: Partial<CreateEventDTO>): Promise<Event> {
    const event = await EventService.findById(id);
    if (!event) throw new ApiError('Event not found.', 404);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.title != null)       { sets.push('title = ?');       params.push(updates.title); }
    if (updates.description != null) { sets.push('description = ?'); params.push(updates.description); }
    if (updates.category != null)    { sets.push('category = ?');    params.push(updates.category); }
    if (updates.event_date != null)  { sets.push('event_date = ?');  params.push(new Date(updates.event_date)); }
    if (updates.location != null)    { sets.push('location = ?');    params.push(updates.location); }

    if (sets.length === 0) return event;
    sets.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
    return (await EventService.findById(id))!; 
  }

  static async deactivate(id: number): Promise<void> {
    await pool.execute('UPDATE events SET is_active = 0 WHERE id = ?', [id]);
  }

  // ─── Participants ───────────────────────────────────────────

  static async registerParticipant(eventId: number, dto: RegisterParticipantDTO): Promise<EventParticipant> {
    const event = await EventService.findById(eventId);
    if (!event) throw new ApiError('Event not found.', 404);

    // Upsert-style: ignore if already registered
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?',
      [eventId, dto.user_id],
    );
    if ((existing as EventParticipant[])[0]) return (existing as EventParticipant[])[0];

    const [res] = await pool.execute(
      'INSERT INTO event_participants (event_id, user_id, role) VALUES (?, ?, ?)',
      [eventId, dto.user_id, dto.role],
    );
    return (await EventService.getParticipant((res as { insertId: number }).insertId))!; 
  }

  static async getParticipant(id: number): Promise<EventParticipant | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM event_participants WHERE id = ?', [id],
    );
    return (rows as EventParticipant[])[0] ?? null;
  }

  static async getParticipantsByEvent(eventId: number): Promise<EventParticipant[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM event_participants WHERE event_id = ?', [eventId],
    );
    return rows as EventParticipant[];
  }

  // ─── Attendance (single-scan) ───────────────────────────────

  /**
   * Mark attendance.  Duplicate scans for the same user+event are ignored.
   */
  static async markAttendance(dto: MarkAttendanceDTO): Promise<Attendance> {
    // Resolve event by QR token
    const event = await EventService.findByQrToken(dto.qr_code_token);
    if (!event) throw new ApiError('Invalid or inactive QR code.', 400);

    // Check for duplicate scan
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM attendances WHERE event_id = ? AND user_id = ?',
      [event.id, dto.user_id],
    );
    if ((existing as Attendance[])[0]) return (existing as Attendance[])[0]; // silently return existing record

    const [res] = await pool.execute(
      `INSERT INTO attendances (event_id, user_id, scan_time, status)
       VALUES (?, ?, NOW(), 'PRESENT')`,
      [event.id, dto.user_id],
    );
    return (await EventService.getAttendance((res as { insertId: number }).insertId))!; 
  }

  static async getAttendance(id: number): Promise<Attendance | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM attendances WHERE id = ?', [id]);
    return (rows as Attendance[])[0] ?? null;
  }

  static async getAttendancesByEvent(eventId: number): Promise<Attendance[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM attendances WHERE event_id = ?', [eventId],
    );
    return rows as Attendance[];
  }

  /** Per-user attendance history across all events */
  static async getAttendanceHistory(userId: number): Promise<(Attendance & { event_title: string; event_date: Date })[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, e.title as event_title, e.event_date
       FROM attendances a
       JOIN events e ON e.id = a.event_id
       WHERE a.user_id = ?
       ORDER BY e.event_date DESC`,
      [userId],
    );
    return rows as (Attendance & { event_title: string; event_date: Date })[];
  }

  // ─── Reports ────────────────────────────────────────────────

  /**
   * Full event-level attendance report generated after event completion.
   */
  static async generateAttendanceReport(eventId: number): Promise<EventAttendanceReport> {
    const event = await EventService.findById(eventId);
    if (!event) throw new ApiError('Event not found.', 404);

    const participants = await EventService.getParticipantsByEvent(eventId);
    const attendances = await EventService.getAttendancesByEvent(eventId);

    const presentSet = new Set(attendances.map((a) => a.user_id));

    const attendees = participants.map((p) => {
      const att = attendances.find((a) => a.user_id === p.user_id);
      return {
        user_id: p.user_id,
        scan_time: att?.scan_time ?? null,
        status: (presentSet.has(p.user_id) ? 'PRESENT' : 'ABSENT') as 'PRESENT' | 'ABSENT',
      };
    });

    return {
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date,
      total_registered: participants.length,
      total_present: attendees.filter((a) => a.status === 'PRESENT').length,
      total_absent: attendees.filter((a) => a.status === 'ABSENT').length,
      attendees,
    };
  }
}
