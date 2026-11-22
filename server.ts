import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db.ts';
import { seedDatabase } from './server/seed.ts';
import authRoutes from './server/routes/authRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import patientRoutes from './server/routes/patientRoutes.ts';
import appointmentRoutes from './server/routes/appointmentRoutes.ts';
import clinicalRoutes from './server/routes/clinicalRoutes.ts';
import pharmacyBillingRoutes from './server/routes/pharmacyBillingRoutes.ts';
import visitRoutes from './server/routes/visitRoutes.ts';

dotenv.config();

async function startServer() {
  // Initialize SQLite relational schema & seed demonstration data
  initializeDatabase();
  seedDatabase();

  const app = express();
  const PORT = 3000;

  // Same-origin / configured origin CORS without wildcard on authenticated routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedAppUrl = process.env.APP_URL?.trim();
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || (allowedAppUrl && origin === allowedAppUrl) || origin.endsWith('.run.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'UP', service: 'Hospital Management Information System API', timestamp: new Date().toISOString() });
  });

  // Mount all REST API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/visits', visitRoutes);
  app.use('/api', clinicalRoutes);
  app.use('/api', pharmacyBillingRoutes);

  // Global API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API Error:', err?.message || err);
    res.status(err?.status || 500).json({
      success: false,
      message: err?.message || 'Internal server error',
    });
  });

  // Vite integration in development vs static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hospital Management Information System Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
