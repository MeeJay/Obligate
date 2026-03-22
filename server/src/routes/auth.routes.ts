import { Router } from 'express';
import { authService } from '../services/auth.service';
import { authLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

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

    // TODO: 2FA check here

    // Establish session
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
    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});
