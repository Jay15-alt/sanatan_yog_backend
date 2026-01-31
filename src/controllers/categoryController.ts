// =============================================================
// src/controllers/categoryController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, resolveActorId } from '../middleware/auth';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { ContributorCategory, CreateContributorCategoryDTO } from '../types';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

/** POST /categories   — Admin adds a custom contributor category */
router.post('/', roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    const dto = req.body as CreateContributorCategoryDTO;
    if (!dto.name || dto.name.trim() === '') {
      return sendError(res, 'Category name is required.', 400);
    }

    // Check uniqueness
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM contributor_categories WHERE name = ?', [dto.name.trim()],
    );
    if ((existing as { id: number }[])[0]) return sendError(res, 'Category already exists.', 409);

    const [res2] = await pool.execute(
      'INSERT INTO contributor_categories (name, is_default, created_by) VALUES (?, 0, ?)',
      [dto.name.trim(), resolveActorId(req.user!)],
    );

    const [row] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM contributor_categories WHERE id = ?',
      [(res2 as { insertId: number }).insertId],
    );
    sendSuccess(res, (row as ContributorCategory[])[0], 201, 'Category created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /categories */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM contributor_categories ORDER BY name',
    );
    sendSuccess(res, rows as ContributorCategory[]);
  } catch { sendError(res, 'Internal error.', 500); }
});

export default router;
