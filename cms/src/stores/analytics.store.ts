import { create } from 'zustand';
import type { AnalyticsOverview } from '@uniclub/shared';
import { AnalyticsApiService } from '../services/analytics.service';

interface AnalyticsState {
  overview: AnalyticsOverview | null;
  loading: boolean;
  error: string | null;
  period: '7d' | '30d' | 'all';

  setPeriod: (period: '7d' | '30d' | 'all') => void;
  fetchOverview: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  overview: null,
  loading: false,
  error: null,
  period: '7d',

  setPeriod: (period) => {
    set({ period });
    get().fetchOverview();
  },

  fetchOverview: async () => {
    set({ loading: true, error: null });
    try {
      const overview = await AnalyticsApiService.getOverview(get().period);
      set({ overview, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || err.message || 'Lỗi không xác định',
        loading: false,
      });
    }
  },
}));
