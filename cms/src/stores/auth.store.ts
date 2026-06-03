import { create } from 'zustand';
import type { AdminUser } from '@uniclub/shared';
import authService from '../services/auth.service';

interface AuthState {
  admin: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  admin: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authService.login({ username, password });
      
      // Lưu vào localStorage
      localStorage.setItem('admin_token', response.token);
      localStorage.setItem('admin_user', JSON.stringify(response.admin));
      
      set({
        admin: response.admin,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({
      admin: null,
      token: null,
      isAuthenticated: false,
    });
  },

  restore: async () => {
    const token = localStorage.getItem('admin_token');
    const adminStr = localStorage.getItem('admin_user');
    
    if (!token || !adminStr) {
      return false;
    }

    try {
      // Verify token còn hợp lệ bằng cách gọi /auth/me
      const admin = await authService.getMe();
      
      set({
        admin,
        token,
        isAuthenticated: true,
      });
      return true;
    } catch {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      return false;
    }
  },
}));

export default useAuthStore;
