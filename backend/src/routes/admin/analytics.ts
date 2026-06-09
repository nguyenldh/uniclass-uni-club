// ============================================================
// Admin Analytics Routes — KPI Dashboard
// ============================================================

import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../../services/analytics.service';

const router = Router();

/**
 * GET /api/admin/analytics/overview?period=7d|30d|all
 * Lấy tổng quan KPI cho CMS Dashboard.
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '7d';
    if (!['7d', '30d', 'all'].includes(period)) {
      res.status(400).json({ error: 'period must be 7d, 30d, or all' });
      return;
    }

    const overview = await AnalyticsService.getOverview(period as '7d' | '30d' | 'all');
    res.json({ success: true, data: overview });
  } catch (error: any) {
    console.error('[Analytics] Error fetching overview:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
