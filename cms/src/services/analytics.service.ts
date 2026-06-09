import api from './api';
import type { AnalyticsOverview } from '@uniclub/shared';

export class AnalyticsApiService {
  /**
   * Lấy KPI overview từ backend.
   * @param period - '7d' | '30d' | 'all'
   */
  static async getOverview(period: string = '7d'): Promise<AnalyticsOverview> {
    const res = await api.get('/analytics/overview', { params: { period } });
    return res.data.data;
  }
}
