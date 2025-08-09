import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types';

// Simple API key authentication middleware
// In production, you'd want to use JWT tokens or OAuth
export function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message:
        'Provide API key in X-API-Key header or Authorization: Bearer <key>',
    });
  }

  // In production, validate against a database or external service
  const validApiKeys = process.env.API_KEYS?.split(',') || ['dev-key-123'];

  if (!validApiKeys.includes(apiKey as string)) {
    return res.status(403).json({
      error: 'Invalid API key',
    });
  }

  // Store API key info for logging/analytics
  req.apiKey = apiKey as string;
  next();
}

// Studio-specific authorization middleware
// Ensures the user has access to the specific studio
export function requireStudioAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const studioId = req.params.studioId;
  // const apiKey = (req as any).apiKey; // Future use for studio-specific permissions

  if (!studioId) {
    return res.status(400).json({ error: 'Studio ID required' });
  }

  // In production, check if the API key has access to this specific studio
  // For now, we allow all authenticated requests
  // TODO: Implement studio-specific permissions

  req.studioId = studioId;
  next();
}

// Optional auth middleware for public endpoints
// Logs requests but doesn't require authentication
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (apiKey) {
    const validApiKeys = process.env.API_KEYS?.split(',') || ['dev-key-123'];
    if (validApiKeys.includes(apiKey as string)) {
      req.apiKey = apiKey as string;
      req.authenticated = true;
    } else {
      req.authenticated = false;
    }
  } else {
    req.authenticated = false;
  }

  next();
}

// Rate limiting middleware (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identifier = req.apiKey || req.ip || 'unknown';
    const now = Date.now();

    const current = requestCounts.get(identifier);

    if (!current || now > current.resetTime) {
      requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
    }

    current.count++;
    next();
  };
}

// Request logging middleware
export function requestLogger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      apiKey: req.apiKey ? `${String(req.apiKey).substring(0, 6)}...` : 'none',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      console.error('API Error:', logData);
    } else {
      console.log('API Request:', logData);
    }
  });

  next();
}
