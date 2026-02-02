// =============================================================
// src/services/peethService.ts
// Business logic for Peeth (Division Level) management
// Adapted to actual schema: admins + users + user_roles
// =============================================================

import pool from '../config/database';
import { ApiError } from '../utils/response';

// Type definitions for Peeth entity
interface Peeth {
  id: number;
  name: string;
  division_code: string;
  location?: string;
  description?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  user_id: number; // References users table (PEETH role user)
  created_by: number; // References admins table
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PeethService {
  /**
   * Helper: Check if user has a specific role
   * @param userId - ID from users table
   * @param roleName - Role name to check
   */
  private static async userHasRole(userId: number, roleName: string): Promise<boolean> {
    const [rows] = await pool.query(
      `SELECT EXISTS(
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? 
          AND r.name = ? 
          AND ur.is_active = 1
      ) as has_role`,
      [userId, roleName]
    );
    return !!(rows as any[])[0]?.has_role;
  }

  /**
   * Helper: Check if admin has required role
   * @param adminId - ID from admins table
   * @param allowedRoles - Array of allowed roles
   */
  private static async adminHasRole(adminId: number, allowedRoles: string[]): Promise<boolean> {
    const [rows] = await pool.query(
      `SELECT role FROM admins WHERE id = ? AND is_active = 1`,
      [adminId]
    );
    
    if ((rows as any[]).length === 0) return false;
    
    const adminRole = (rows as any[])[0].role;
    return allowedRoles.includes(adminRole);
  }

  /**
   * Create a new Peeth (Division)
   * Only ADMIN and SUBADMIN (from admins table) can create Peeths
   * @param data - Peeth data including user_id (from users table with PEETH role)
   * @param createdByAdminId - ID from admins table
   */
  static async create(
    data: {
      name: string;
      division_code: string;
      user_id: number; // User from users table with PEETH role
      location?: string;
      description?: string;
      contact_person?: string;
      contact_phone?: string;
      contact_email?: string;
    },
    createdByAdminId: number
  ): Promise<Peeth> {
    // Verify creator is an active admin
    const isAuthorized = await this.adminHasRole(createdByAdminId, ['ADMIN', 'SUBADMIN']);
    
    if (!isAuthorized) {
      throw new ApiError('Only ADMIN or SUBADMIN can create Peeths.', 403);
    }

    // Verify the assigned user has PEETH role
    const hasPeethRole = await this.userHasRole(data.user_id, 'PEETH');
    if (!hasPeethRole) {
      throw new ApiError('Assigned user must have PEETH role.', 400);
    }

    // Check if division_code already exists
    const [existingRows] = await pool.query(
      'SELECT * FROM peeths WHERE division_code = ?',
      [data.division_code]
    );

    if ((existingRows as any[]).length > 0) {
      throw new ApiError('Division code already exists.', 400);
    }

    // Check if user_id already assigned to another Peeth
    const [existingUserRows] = await pool.query(
      'SELECT * FROM peeths WHERE user_id = ?',
      [data.user_id]
    );

    if ((existingUserRows as any[]).length > 0) {
      throw new ApiError('This user is already assigned to another Peeth.', 400);
    }

    // Verify assigned user exists and is active
    const [userRows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND status = "ACTIVE"',
      [data.user_id]
    );

    if ((userRows as any[]).length === 0) {
      throw new ApiError('Assigned user not found or is not active.', 400);
    }

    const [rows] = await pool.query(
      `INSERT INTO peeths (name, division_code, user_id, location, description, contact_person, contact_phone, contact_email, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.division_code,
        data.user_id,
        data.location,
        data.description,
        data.contact_person,
        data.contact_phone,
        data.contact_email,
        createdByAdminId,
        true,
      ]
    );

    // Get the inserted record with user details
    const [insertedRows] = await pool.query(
      `SELECT p.*, 
              u.unique_id as user_unique_id,
              u.email as user_email,
              u.phone as user_phone,
              u.status as user_status,
              a.name as created_by_name,
              a.email as created_by_email,
              a.role as created_by_role
       FROM peeths p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN admins a ON p.created_by = a.id
       WHERE p.id = ?`,
      [(rows as any).insertId]
    );

    return (insertedRows as any[])[0];
  }

  /**
   * List all Peeths with optional filters
   * Admins see all, PEETH users see only their assigned Peeth
   */
  static async findAll(
    filters?: {
      is_active?: boolean;
      search?: string;
    },
    requestingUserId?: number,
    isAdmin: boolean = false
  ): Promise<any[]> {
    let query = `
      SELECT p.*, 
             u.unique_id as user_unique_id,
             u.email as user_email,
             u.phone as user_phone,
             u.status as user_status,
             a.name as created_by_name,
             COUNT(DISTINCT s.id) as shakha_count
      FROM peeths p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN admins a ON p.created_by = a.id
      LEFT JOIN shakhas s ON s.peeth_id = p.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    // If requesting user is PEETH role (not admin), only show their Peeth
    if (!isAdmin && requestingUserId) {
      conditions.push(`p.user_id = ?`);
      params.push(requestingUserId);
    }

    if (filters?.is_active !== undefined) {
      conditions.push(`p.is_active = ?`);
      params.push(filters.is_active);
    }

    if (filters?.search) {
      conditions.push(`(
        p.name LIKE ? OR 
        p.division_code LIKE ? OR 
        p.location LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const [rows] = await pool.query(query, params);
    return rows as any[];
  }

  /**
   * Get single Peeth by ID
   */
  static async findById(
    id: number, 
    requestingUserId?: number,
    isAdmin: boolean = false
  ): Promise<Peeth | null> {
    const [rows] = await pool.query(
      `SELECT p.*, 
              u.unique_id as user_unique_id,
              u.email as user_email,
              u.phone as user_phone,
              u.status as user_status,
              a.name as created_by_name,
              a.email as created_by_email,
              a.role as created_by_role,
              COUNT(DISTINCT s.id) as shakha_count
       FROM peeths p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN admins a ON p.created_by = a.id
       LEFT JOIN shakhas s ON s.peeth_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`,
      [id]
    );

    const result = rows as any[];
    if (result.length === 0) return null;

    // If requesting user is PEETH role (not admin), verify they own this Peeth
    if (!isAdmin && requestingUserId && result[0].user_id !== requestingUserId) {
      throw new ApiError('You can only view your assigned Peeth.', 403);
    }

    return result[0];
  }

  /**
   * Get Peeth by division code
   */
  static async findByDivisionCode(divisionCode: string): Promise<Peeth | null> {
    const [rows] = await pool.query(
      `SELECT p.*,
              u.unique_id as user_unique_id,
              u.email as user_email,
              u.phone as user_phone,
              u.status as user_status
       FROM peeths p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.division_code = ?`,
      [divisionCode]
    );

    const result = rows as any[];
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get Peeth by user ID (find which Peeth a user manages)
   */
  static async findByUserId(userId: number): Promise<Peeth | null> {
    const [rows] = await pool.query(
      `SELECT p.*,
              u.unique_id as user_unique_id,
              u.email as user_email,
              u.phone as user_phone,
              u.status as user_status
       FROM peeths p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?`,
      [userId]
    );

    const result = rows as any[];
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update Peeth details
   * Only ADMIN and SUBADMIN can update
   */
  static async update(
    id: number,
    data: {
      name?: string;
      division_code?: string;
      user_id?: number;
      location?: string;
      description?: string;
      contact_person?: string;
      contact_phone?: string;
      contact_email?: string;
    },
    updatedByAdminId: number
  ): Promise<Peeth> {
    // Verify updater is an active admin
    const isAuthorized = await this.adminHasRole(updatedByAdminId, ['ADMIN', 'SUBADMIN']);
    
    if (!isAuthorized) {
      throw new ApiError('Only ADMIN or SUBADMIN can update Peeths.', 403);
    }

    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [id]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    const peeth = peethResult[0];

    // If updating user_id, verify new user has PEETH role
    if (data.user_id && data.user_id !== peeth.user_id) {
      const hasPeethRole = await this.userHasRole(data.user_id, 'PEETH');
      if (!hasPeethRole) {
        throw new ApiError('Assigned user must have PEETH role.', 400);
      }

      // Check if user is already assigned to another Peeth
      const [existingUserRows] = await pool.query(
        'SELECT * FROM peeths WHERE user_id = ? AND id != ?',
        [data.user_id, id]
      );

      if ((existingUserRows as any[]).length > 0) {
        throw new ApiError('This user is already assigned to another Peeth.', 400);
      }

      // Verify user is active
      const [userRows] = await pool.query(
        'SELECT * FROM users WHERE id = ? AND status = "ACTIVE"',
        [data.user_id]
      );

      if ((userRows as any[]).length === 0) {
        throw new ApiError('Assigned user not found or is not active.', 400);
      }
    }

    // If updating division_code, check for duplicates
    if (data.division_code && data.division_code !== peeth.division_code) {
      const [existingRows] = await pool.query(
        'SELECT * FROM peeths WHERE division_code = ?',
        [data.division_code]
      );

      if ((existingRows as any[]).length > 0) {
        throw new ApiError('Division code already exists.', 400);
      }
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updateFields.push(`name = ?`);
      params.push(data.name);
    }
    if (data.division_code !== undefined) {
      updateFields.push(`division_code = ?`);
      params.push(data.division_code);
    }
    if (data.user_id !== undefined) {
      updateFields.push(`user_id = ?`);
      params.push(data.user_id);
    }
    if (data.location !== undefined) {
      updateFields.push(`location = ?`);
      params.push(data.location);
    }
    if (data.description !== undefined) {
      updateFields.push(`description = ?`);
      params.push(data.description);
    }
    if (data.contact_person !== undefined) {
      updateFields.push(`contact_person = ?`);
      params.push(data.contact_person);
    }
    if (data.contact_phone !== undefined) {
      updateFields.push(`contact_phone = ?`);
      params.push(data.contact_phone);
    }
    if (data.contact_email !== undefined) {
      updateFields.push(`contact_email = ?`);
      params.push(data.contact_email);
    }

    if (updateFields.length === 0) {
      throw new ApiError('No fields to update.', 400);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    await pool.query(
      `UPDATE peeths SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch and return updated record with user details
    const [updatedRows] = await pool.query(
      `SELECT p.*,
              u.unique_id as user_unique_id,
              u.email as user_email,
              u.phone as user_phone,
              u.status as user_status
       FROM peeths p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    return (updatedRows as any[])[0];
  }

  /**
   * Deactivate Peeth (soft delete)
   */
  static async deactivate(id: number, deactivatedByAdminId: number): Promise<Peeth> {
    // Verify deactivator is an active admin
    const isAuthorized = await this.adminHasRole(deactivatedByAdminId, ['ADMIN', 'SUBADMIN']);
    
    if (!isAuthorized) {
      throw new ApiError('Only ADMIN or SUBADMIN can deactivate Peeths.', 403);
    }

    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [id]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    // Check if Peeth has active Shakhas
    const [shakhaRows] = await pool.query(
      'SELECT COUNT(*) as count FROM shakhas WHERE peeth_id = ? AND is_active = true',
      [id]
    );

    const activeShakhas = parseInt((shakhaRows as any[])[0].count);

    if (activeShakhas > 0) {
      throw new ApiError(
        `Cannot deactivate Peeth. It has ${activeShakhas} active Shakha(s). Please deactivate them first.`,
        400
      );
    }

    await pool.query(
      'UPDATE peeths SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    const [rows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [id]);
    return (rows as any[])[0];
  }

  /**
   * Activate Peeth
   */
  static async activate(id: number, activatedByAdminId: number): Promise<Peeth> {
    // Verify activator is an active admin
    const isAuthorized = await this.adminHasRole(activatedByAdminId, ['ADMIN', 'SUBADMIN']);
    
    if (!isAuthorized) {
      throw new ApiError('Only ADMIN or SUBADMIN can activate Peeths.', 403);
    }

    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [id]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    await pool.query(
      'UPDATE peeths SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    const [rows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [id]);
    return (rows as any[])[0];
  }

  /**
   * Get all Shakhas under a Peeth
   */
  static async getShakhas(
    peethId: number, 
    requestingUserId?: number,
    isAdmin: boolean = false
  ) {
    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [peethId]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    // If requesting user is PEETH role (not admin), verify they own this Peeth
    if (!isAdmin && requestingUserId && peethResult[0].user_id !== requestingUserId) {
      throw new ApiError('You can only view Shakhas of your assigned Peeth.', 403);
    }

    const [rows] = await pool.query(
      `SELECT s.*, 
              COUNT(DISTINCT ss.id) as subshakha_count,
              COUNT(DISTINCT t.id) as team_count
       FROM shakhas s
       LEFT JOIN subshakhas ss ON ss.shakha_id = s.id
       LEFT JOIN teams t ON t.shakha_id = s.id
       WHERE s.peeth_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [peethId]
    );

    return rows as any[];
  }

  /**
   * Get Peeth statistics and analytics
   */
  static async getStatistics(
    peethId: number, 
    requestingUserId?: number,
    isAdmin: boolean = false
  ) {
    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [peethId]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    const peeth = peethResult[0];

    // If requesting user is PEETH role (not admin), verify they own this Peeth
    if (!isAdmin && requestingUserId && peeth.user_id !== requestingUserId) {
      throw new ApiError('You can only view statistics of your assigned Peeth.', 403);
    }

    // Total Shakhas
    const [shakhaRows] = await pool.query(
      'SELECT COUNT(*) as count FROM shakhas WHERE peeth_id = ? AND is_active = true',
      [peethId]
    );

    // Total SubShakhas
    const [subshakhaRows] = await pool.query(
      `SELECT COUNT(*) as count FROM subshakhas ss
       INNER JOIN shakhas s ON ss.shakha_id = s.id
       WHERE s.peeth_id = ? AND ss.is_active = true`,
      [peethId]
    );

    // Total Teams
    const [teamRows] = await pool.query(
      `SELECT COUNT(*) as count FROM teams t
       LEFT JOIN shakhas s ON t.shakha_id = s.id
       LEFT JOIN subshakhas ss ON t.subshakha_id = ss.id
       LEFT JOIN shakhas s2 ON ss.shakha_id = s2.id
       WHERE (s.peeth_id = ? OR s2.peeth_id = ?) AND t.is_active = true`,
      [peethId, peethId]
    );

    // Total Contributors (from contributors table)
    const [contributorRows] = await pool.query(
      `SELECT COUNT(*) as count FROM contributors c
       WHERE c.assigned_team_id IN (
         SELECT t.id FROM teams t
         LEFT JOIN shakhas s ON t.shakha_id = s.id
         LEFT JOIN subshakhas ss ON t.subshakha_id = ss.id
         LEFT JOIN shakhas s2 ON ss.shakha_id = s2.id
         WHERE (s.peeth_id = ? OR s2.peeth_id = ?)
       ) AND c.is_active = true`,
      [peethId, peethId]
    );

    return {
      peeth_id: peethId,
      peeth_name: peeth.name,
      division_code: peeth.division_code,
      statistics: {
        total_shakhas: parseInt((shakhaRows as any[])[0].count),
        total_subshakhas: parseInt((subshakhaRows as any[])[0].count),
        total_teams: parseInt((teamRows as any[])[0].count),
        total_contributors: parseInt((contributorRows as any[])[0].count),
      },
    };
  }

  /**
   * Get contributors summary for a Peeth
   */
  static async getContributorsSummary(
    peethId: number,
    filters?: {
      contributor_type?: 'GENERAL' | 'TRUSTEE' | 'GRUHINI';
      pan_status?: string;
    },
    requestingUserId?: number,
    isAdmin: boolean = false
  ) {
    const [peethRows] = await pool.query('SELECT * FROM peeths WHERE id = ?', [peethId]);
    const peethResult = peethRows as any[];

    if (peethResult.length === 0) {
      throw new ApiError('Peeth not found.', 404);
    }

    const peeth = peethResult[0];

    // If requesting user is PEETH role (not admin), verify they own this Peeth
    if (!isAdmin && requestingUserId && peeth.user_id !== requestingUserId) {
      throw new ApiError('You can only view contributors of your assigned Peeth.', 403);
    }

    let query = `
      SELECT c.*,
             u.email as user_email,
             u.phone as user_phone,
             u.status as user_status
      FROM contributors c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.assigned_team_id IN (
        SELECT t.id FROM teams t
        LEFT JOIN shakhas s ON t.shakha_id = s.id
        LEFT JOIN subshakhas ss ON t.subshakha_id = ss.id
        LEFT JOIN shakhas s2 ON ss.shakha_id = s2.id
        WHERE (s.peeth_id = ? OR s2.peeth_id = ?)
      ) AND c.is_active = true
    `;

    const params: any[] = [peethId, peethId];

    if (filters?.contributor_type) {
      query += ` AND c.contributor_type = ?`;
      params.push(filters.contributor_type);
    }

    if (filters?.pan_status) {
      query += ` AND c.pan_status = ?`;
      params.push(filters.pan_status);
    }

    query += ` ORDER BY c.created_at DESC`;

    const [rows] = await pool.query(query, params);
    const contributors = rows as any[];

    // Calculate summary
    const summary = {
      total_contributors: contributors.length,
      by_type: {
        GENERAL: contributors.filter(c => c.contributor_type === 'GENERAL').length,
        TRUSTEE: contributors.filter(c => c.contributor_type === 'TRUSTEE').length,
        GRUHINI: contributors.filter(c => c.contributor_type === 'GRUHINI').length,
      },
      by_pan_status: {
        NOT_UPLOADED: contributors.filter(c => c.pan_status === 'NOT_UPLOADED').length,
        PENDING: contributors.filter(c => c.pan_status === 'PENDING').length,
        VERIFIED: contributors.filter(c => c.pan_status === 'VERIFIED').length,
        REJECTED: contributors.filter(c => c.pan_status === 'REJECTED').length,
      },
      by_gender: {
        MALE: contributors.filter(c => c.gender === 'MALE').length,
        FEMALE: contributors.filter(c => c.gender === 'FEMALE').length,
        OTHER: contributors.filter(c => c.gender === 'OTHER').length,
      },
    };

    return {
      peeth_id: peethId,
      peeth_name: peeth.name,
      division_code: peeth.division_code,
      filters,
      summary,
      contributors,
    };
  }
}