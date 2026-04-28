import { create } from 'zustand';
import apiClient from '../api/client';
import { applyTheme } from '../utils/theme';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: 'admin' | 'user';
  isActive: boolean;
  authSource: string;
  preferredLanguage: string;
  preferredTheme: string;
  enrollmentVersion: number;
}

interface AuthState {
  user: User | null;
  requiresEnrollment: boolean;
  requires2faSetup: boolean;
  smtpConfigured: boolean;
  checkSession: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; requires2fa?: boolean }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  requiresEnrollment: false,
  requires2faSetup: false,
  smtpConfigured: false,

  checkSession: async () => {
    try {
      const { data } = await apiClient.get('/auth/me');
      if (data.success) {
        const user = data.data.user;
        set({
          user,
          requiresEnrollment: data.data.requiresEnrollment ?? false,
          requires2faSetup: data.data.requires2faSetup ?? false,
          smtpConfigured: data.data.smtpConfigured ?? false,
        });
        if (user.preferredTheme) applyTheme(user.preferredTheme);
        return true;
      }
    } catch { /* ignore */ }
    set({ user: null, requiresEnrollment: false, requires2faSetup: false, smtpConfigured: false });
    return false;
  },

  login: async (username, password) => {
    try {
      const { data } = await apiClient.post('/auth/login', { username, password });
      if (data.success) {
        if (data.data.requires2fa) {
          return { success: true, requires2fa: true };
        }
        // Fetch full session (includes requiresEnrollment + theme) instead of using login response directly
        const { checkSession } = useAuthStore.getState();
        await checkSession();
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch {
      return { success: false, error: 'Connection error' };
    }
  },

  logout: async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    set({ user: null, requiresEnrollment: false });
  },
}));
