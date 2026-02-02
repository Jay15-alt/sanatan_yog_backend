// =============================================================
// src/server.ts   — Server entry-point
// =============================================================

import app from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Start server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Client Doc Flow API running on http://localhost:${PORT}`);
});