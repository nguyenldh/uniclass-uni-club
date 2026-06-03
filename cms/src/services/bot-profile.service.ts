import api from './api';
import type { BotProfile, CreateBotProfileInput, UpdateBotProfileInput } from '@uniclub/shared';

interface BotProfileListResponse {
  success: boolean;
  profiles: BotProfile[];
  count: number;
}

interface BotProfileResponse {
  success: boolean;
  profile: BotProfile;
}

export const botProfileService = {
  /**
   * Lấy tất cả bot profiles (bao gồm inactive)
   */
  async getAll(): Promise<BotProfile[]> {
    const response = await api.get<BotProfileListResponse>('/bot-profiles');
    return response.data.profiles;
  },

  /**
   * Lấy bot profile theo ID
   */
  async getById(id: string): Promise<BotProfile> {
    const response = await api.get<BotProfileResponse>(`/bot-profiles/${id}`);
    return response.data.profile;
  },

  /**
   * Tạo bot profile mới
   */
  async create(input: CreateBotProfileInput): Promise<BotProfile> {
    const response = await api.post<BotProfileResponse>('/bot-profiles', input);
    return response.data.profile;
  },

  /**
   * Tạo nhiều bot profiles cùng lúc
   */
  async createMany(inputs: CreateBotProfileInput[]): Promise<BotProfile[]> {
    const response = await api.post<BotProfileListResponse>('/bot-profiles/bulk', { profiles: inputs });
    return response.data.profiles;
  },

  /**
   * Cập nhật bot profile
   */
  async update(id: string, input: UpdateBotProfileInput): Promise<BotProfile> {
    const response = await api.put<BotProfileResponse>(`/bot-profiles/${id}`, input);
    return response.data.profile;
  },

  /**
   * Toggle trạng thái active
   */
  async toggleActive(id: string): Promise<BotProfile> {
    const response = await api.patch<BotProfileResponse>(`/bot-profiles/${id}/toggle-active`);
    return response.data.profile;
  },

  /**
   * Xóa bot profile
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/bot-profiles/${id}`);
  },

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<number> {
    const response = await api.post<{ success: boolean; message: string; count: number }>('/bot-profiles/refresh-cache');
    return response.data.count;
  },

  /**
   * Seed default bots
   */
  async seedDefaults(): Promise<number> {
    const response = await api.post<{ success: boolean; message: string; count: number }>('/bot-profiles/seed');
    return response.data.count;
  },
};

export default botProfileService;
