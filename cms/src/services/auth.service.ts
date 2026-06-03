import api from './api';
import type { AdminLoginRequest, AdminLoginResponse, AdminUser } from '@uniclub/shared';

export const authService = {
  /**
   * Đăng nhập admin
   */
  async login(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    const response = await api.post<AdminLoginResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Lấy thông tin admin hiện tại
   */
  async getMe(): Promise<AdminUser> {
    const response = await api.get<{ success: boolean; admin: AdminUser }>('/auth/me');
    return response.data.admin;
  },
};

export default authService;
