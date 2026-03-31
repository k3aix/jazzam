import { Router, Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

const requireAdminKey = (req: Request, res: Response, next: () => void) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ error: 'Admin not configured' });
    return;
  }
  const provided = req.headers['x-admin-key'];
  if (provided !== adminKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

// GET /api/admin/standards — returns title, book_source, created_at for all standards
router.get('/standards', requireAdminKey, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT title, book_source, created_at
       FROM jazz_standards
       ORDER BY title ASC`
    );
    res.json({ count: result.rowCount, standards: result.rows });
  } catch (err) {
    console.error('Admin standards query failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
