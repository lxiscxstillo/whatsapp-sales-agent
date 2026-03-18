import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Validates the x-internal-key header for internal service-to-service calls.
 * Used by Next.js Route Handlers to authenticate against the backend API.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Webhook from WPPConnect does not use internal key — it's on a separate path
  if (req.path.startsWith('/api/v1/webhook')) {
    next();
    return;
  }

  const key = req.headers['x-internal-key'];
  if (!key || key !== config.INTERNAL_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
