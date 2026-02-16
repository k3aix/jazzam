import { Router, Request, Response } from 'express';
import { StandardsService } from '../services/standardsService';

const router = Router();
const standardsService = new StandardsService();

/**
 * GET /api/standards
 * Get all jazz standards
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const standards = await standardsService.getAllStandards();
    res.json({
      success: true,
      count: standards.length,
      data: standards,
    });
  } catch (error) {
    console.error('Error fetching standards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standards',
    });
  }
});

/**
 * GET /api/standards/:id
 * Get a specific standard by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const standard = await standardsService.getStandardById(id);

    if (!standard) {
      return res.status(404).json({
        success: false,
        error: 'Standard not found',
      });
    }

    return res.json({
      success: true,
      data: standard,
    });
  } catch (error) {
    console.error('Error fetching standard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch standard',
    });
  }
});

/**
 * POST /api/standards/search
 * Search for standards by interval sequence
 * Body: { intervals: number[], minConfidence?: number }
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { intervals, minConfidence } = req.body;

    if (!intervals || !Array.isArray(intervals) || intervals.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search query. Must provide at least 2 intervals.',
      });
    }

    const startTime = Date.now();
    const results = await standardsService.searchByIntervals({
      intervals,
      minConfidence,
    });
    const executionTime = Date.now() - startTime;

    return res.json({
      success: true,
      count: results.length,
      executionTime: `${executionTime}ms`,
      data: results,
    });
  } catch (error) {
    console.error('Error searching standards:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search standards',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Standards Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
