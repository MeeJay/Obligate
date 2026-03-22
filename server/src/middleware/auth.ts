import type { Request, Response, NextFunction } from 'express';

// Extend express-session
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
    // 2FA pending state
    pendingMfaUserId?: number;
  }
}

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    next(new AppError(401, 'Authentication required'));
  } else {
    next();
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    next(new AppError(401, 'Authentication required'));
  } else if (req.session.role !== 'admin') {
    next(new AppError(403, 'Admin access required'));
  } else {
    next();
  }
}
