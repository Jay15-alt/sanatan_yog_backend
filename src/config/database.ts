// =============================================================
// src/config/database.ts
// mysql2 connection-pool singleton
// =============================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT || '3306', 10),
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'client_doc_flow',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  typeCast(field, next) {
    // Return Buffer fields as strings (e.g. DECIMAL)
    if (field.type === 'DECIMAL') return next();
    return next();
  },
});

// Quick connectivity check on import (non-blocking)
pool.getConnection()
  .then((conn) => { conn.release(); console.log('[DB] Pool connected successfully.'); })
  .catch((err: Error) => { console.error('[DB] Connection failed –', err.message); });

export default pool;
