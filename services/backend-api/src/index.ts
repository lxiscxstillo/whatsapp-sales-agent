import express from 'express';
import { config } from './config';
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { webhookRouter } from './routes/webhook.route';
import { leadsRouter } from './routes/leads.route';
import { handoffRouter } from './routes/handoff.route';
import { prisma } from './services/prisma.client';
import logger from './utils/logger';

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(authMiddleware);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/v1/webhook', webhookRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/leads', handoffRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ── Startup ───────────────────────────────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    logger.info({ event: 'startup', message: 'PostgreSQL connected' });

    app.listen(config.PORT, () => {
      logger.info({ event: 'startup', message: `Backend API listening on port ${config.PORT}` });
    });
  } catch (err) {
    logger.error({ event: 'startup_failed', message: String(err) });
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info({ event: 'shutdown', message: 'SIGTERM received, closing connections' });
  await prisma.$disconnect();
  process.exit(0);
});
