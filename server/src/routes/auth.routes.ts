import { Router } from 'express';
import { db } from '../db';
import { authService } from '../services/auth.service';
import { preferencesService } from '../services/preferences.service';
import { authLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

const REQUIRED_ENROLLMENT_VERSION = 1;

export const authRoutes = Router();

// POST /api/auth/login
authRoutes.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    // TODO: Add LDAP login resolution here (DOMAIN\user or user@domain)
    const user = await authService.login(username, password);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // 2FA check — if TOTP is enabled, don't complete session yet
    if (user.totpEnabled) {
      req.session.pendingMfaUserId = user.id;
      res.json({
        success: true,
        data: {
          requires2fa: true,
          methods: { totp: true },
        },
      });
      return;
    }

    // No MFA — establish session immediately
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/auth/logout
authRoutes.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /api/auth/me
authRoutes.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await authService.getUserById(req.session.userId!);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }
    // Include enrollment check
    const row = await db('users').where({ id: user.id }).select('enrollment_version').first() as { enrollment_version: number } | undefined;
    const enrollmentVersion = row?.enrollment_version ?? 0;
    res.json({
      success: true,
      data: {
        user: { ...user, enrollmentVersion },
        requiresEnrollment: enrollmentVersion < REQUIRED_ENROLLMENT_VERSION,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// POST /api/auth/enrollment
authRoutes.post('/enrollment', requireAuth, async (req, res) => {
  try {
    const { displayName, email, preferredLanguage, preferredTheme, toastEnabled, toastPosition } = req.body as {
      displayName?: string; email?: string; preferredLanguage?: string;
      preferredTheme?: string; toastEnabled?: boolean; toastPosition?: string;
    };

    const userId = req.session.userId!;

    // Update user profile
    const userUpdate: Record<string, unknown> = {
      enrollment_version: REQUIRED_ENROLLMENT_VERSION,
      updated_at: new Date(),
    };
    if (displayName !== undefined) userUpdate.display_name = displayName;
    if (email !== undefined) userUpdate.email = email;
    if (preferredLanguage !== undefined) userUpdate.preferred_language = preferredLanguage;
    await db('users').where({ id: userId }).update(userUpdate);

    // Update common preferences
    await preferencesService.updateCommonPreferences(userId, {
      preferredTheme: preferredTheme ?? 'modern',
      toastEnabled: toastEnabled ?? true,
      toastPosition: toastPosition ?? 'bottom-right',
      preferredLanguage: preferredLanguage ?? 'en',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to complete enrollment' });
  }
});
