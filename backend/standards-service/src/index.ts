import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { serverConfig } from './config/database';
import { pool } from './config/db';
import standardsRoutes from './routes/standards';
import adminRoutes from './routes/admin';

const app: Application = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: serverConfig.corsOrigin })); // CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use('/api/standards', standardsRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'Jazz Melody Finder - Standards Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/standards/health',
      getAllStandards: 'GET /api/standards',
      getStandard: 'GET /api/standards/:id',
      search: 'POST /api/standards/search',
    },
  });
});

// Health check endpoint (also available at root level)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Standards Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection verified');

    app.listen(serverConfig.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║   🎵 Jazz Melody Finder - Standards Service           ║
╟────────────────────────────────────────────────────────╢
║   Server running on: http://localhost:${serverConfig.port}        ║
║   Environment: ${serverConfig.nodeEnv}                      ║
║   Database: ${pool.options.database}                  ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

startServer();
