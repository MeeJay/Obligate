import { create } from 'zustand';
import apiClient from '../api/client';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: 'admin' | 'user';
  isActive: boolean;
  authSource: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  checkSession: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  checkSession: async () => {
    try {
      const { data } = await apiClient.get('/auth/me');
      if (data.success) {
        set({ user: data.data.user, loading: false });
        return true;
      }
    } catch { /* ignore */ }
    set({ user: null, loading: false });
    return false;
  },

  login: async (username, password) => {
    try {
      const { data } = await apiClient.post('/auth/login', { username, password });
      if (data.success) {
        set({ user: data.data.user });
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch {
      return { success: false, error: 'Connection error' };
    }
  },

  logout: async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    set({ user: null });
  },
}));
