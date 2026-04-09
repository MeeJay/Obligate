import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'path';
import { existsSync } from 'fs';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { routes } from './routes';
import { logger } from './utils/logger';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Session
  const isHttps = config.clientOrigin.startsWith('https://');
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL || 'postgres://obligate:changeme@localhost:5432/obligate',
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: config.sessionMaxAge,
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
      },
    }),
  );

  // Rate limiting (skip authenticated users)
  app.use('/api', apiLimiter);

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // OAuth authorize endpoint at root for clean URLs (MUST be before static serving)
  app.get('/authorize', (req, res) => {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(`/api/oauth/authorize?${qs}`);
  });

  // SSO logout — destroys Obligate session and redirects back to the calling app
  app.get('/logout', (req, res) => {
    const redirectUri = (req.query.redirect_uri as string) || '/login';
    req.session.destroy(() => {
      res.redirect(redirectUri);
    });
  });

  // API routes
  app.use('/api', routes);

  // Serve static client in production
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(clientDist)) {
    // Assets have content-hash filenames → cache aggressively
    app.use(express.static(clientDist, { maxAge: '7d', immutable: true }));
    // index.html → never cache (so new builds are picked up immediately)
    const indexPath = path.join(clientDist, 'index.html');
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexPath);
    });
  }

  // Error handler
  app.use(errorHandler);

  return app;
}
