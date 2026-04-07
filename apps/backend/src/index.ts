import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import authRouter from './routes/api/auth';
import syncRouter from './routes/api/sync';
import adminRouter from './routes/api/admin';
import poisRouter from './routes/api/pois';
import toursRouter from './routes/api/tours';
import analyticsRouter from './routes/api/analytics';
import prisma from './lib/prisma';
import { errorHandlingMiddleware, notFoundMiddleware } from './middlewares/errorHandlingMiddleware';
import { initializeTtsWorker, validateTtsRuntimeConfig } from './services/ttsService';
import { initializePoiSoftDeleteCleanupScheduler } from './services/poiAdminService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAPI_FILE_PATH = path.resolve(process.cwd(), 'openapi.json');

function loadOpenApiSpec() {
  if (!fs.existsSync(OPENAPI_FILE_PATH)) {
    return {
      openapi: '3.0.0',
      info: {
        title: 'PhoAmThuc API',
        version: '1.0.0',
        description: 'OpenAPI file not generated yet. Run: npm run openapi:generate'
      },
      paths: {}
    };
  }

  return JSON.parse(fs.readFileSync(OPENAPI_FILE_PATH, 'utf8'));
}

app.use(cors());
app.use(helmet());
app.use(compression({ threshold: 0 }));
app.use(express.json());
app.use('/audio', express.static(path.resolve(process.cwd(), 'public/audio')));
app.get('/api-docs/swagger.json', (_req, res) => {
  return res.status(200).json(loadOpenApiSpec());
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/api-docs/swagger.json' }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/pois', poisRouter);
app.use('/api/v1/tours', toursRouter);
app.use('/api/v1/analytics', analyticsRouter);

app.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      message: 'Mobile Backend is running!',
      service: 'Node.js + Express',
      db_status: 'Connected',
      db_type: 'PostgreSQL + PostGIS'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Backend running but DB connection failed',
      error: error
    });
  }
});

app.use(notFoundMiddleware);
app.use(errorHandlingMiddleware);

app.listen(PORT, "0.0.0.0", async () => { // Thêm "0.0.0.0" để cho phép kết nối từ ngoài vào
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    const ttsValidation = validateTtsRuntimeConfig();
    if (!ttsValidation.ok) {
      console.error('TTS runtime configuration invalid:', ttsValidation.errors);
      if (process.env.TTS_STRICT_CONFIG === 'true') {
        throw new Error('TTS runtime configuration is invalid in strict mode.');
      }
    }
    if (ttsValidation.warnings.length > 0) {
      console.warn('TTS runtime configuration warnings:', ttsValidation.warnings);
    }

    await initializeTtsWorker();
    console.log('TTS worker initialized');

    const cleanupTimer = initializePoiSoftDeleteCleanupScheduler();
    if (cleanupTimer) {
      console.log('POI soft-delete cleanup scheduler initialized');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
  }
});
// Thêm vào cuối file index.ts
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});