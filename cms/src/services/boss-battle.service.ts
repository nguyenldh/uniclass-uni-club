import api from './api';
import type {
  BossBattleConfig,
  BossQuestion,
  BossQuestionSet,
  BossLeaderboardResponse,
  BossInstanceMonitorEntry,
  WeeklyHonor,
  CreateBossQuestionInput,
  UpdateBossQuestionInput,
  BulkUpsertBossQuestionInput,
  BossQuestionBulkCreateResponse,
  BossQuestionBulkUpsertResponse,
  BossBattleConfigOverride,
  BossWeeklyConfig,
} from '@uniclub/shared';

export interface ListBossQuestionsParams {
  grade?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListBossQuestionsResult {
  items: BossQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AutoGenerateResult {
  weekKey: string;
  gradeLevel: number;
  created: number;
  skipped: number;
  sets: BossQuestionSet[];
}

export interface InitWeekResult {
  weekKey: string;
  initializedGrades: number[];
  skippedGrades: number[];
  closedPreviousWeek: boolean;
  previousWeekKey?: string;
}

export interface CloseWeekResult {
  weekKey: string;
  honorsCreated: Array<{ gradeLevel: number; count: number }>;
}

export const bossBattleService = {
  // ---- Config ----
  async getConfig(): Promise<BossBattleConfig> {
    const res = await api.get<{ success: boolean; config: BossBattleConfig }>(
      '/boss-battle/config',
    );
    return res.data.config;
  },
  async updateConfig(config: BossBattleConfig): Promise<BossBattleConfig> {
    const res = await api.put<{ success: boolean; config: BossBattleConfig }>(
      '/boss-battle/config',
      config,
    );
    return res.data.config;
  },

  // ---- Questions ----
  async listQuestions(params: ListBossQuestionsParams): Promise<ListBossQuestionsResult> {
    const res = await api.get<{ success: boolean } & ListBossQuestionsResult>(
      '/boss-battle/questions',
      { params },
    );
    return {
      items: res.data.items,
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    };
  },
  async getQuestion(id: string): Promise<BossQuestion | null> {
    try {
      const res = await api.get<{ success: boolean; question: BossQuestion }>(
        `/boss-battle/questions/${id}`,
      );
      return res.data.question;
    } catch {
      return null;
    }
  },
  async getQuestionsByIds(ids: string[]): Promise<BossQuestion[]> {
    if (ids.length === 0) return [];
    const res = await api.post<{ success: boolean; items: BossQuestion[] }>(
      '/boss-battle/questions/by-ids',
      { ids },
    );
    return res.data.items;
  },
  async createQuestion(input: CreateBossQuestionInput): Promise<BossQuestion> {
    const res = await api.post<{ success: boolean; question: BossQuestion }>(
      '/boss-battle/questions',
      input,
    );
    return res.data.question;
  },
  async updateQuestion(id: string, input: UpdateBossQuestionInput): Promise<BossQuestion> {
    const res = await api.put<{ success: boolean; question: BossQuestion }>(
      `/boss-battle/questions/${id}`,
      input,
    );
    return res.data.question;
  },
  async deleteQuestion(id: string): Promise<void> {
    await api.delete(`/boss-battle/questions/${id}`);
  },
  async bulkCreateQuestions(
    questions: CreateBossQuestionInput[],
  ): Promise<BossQuestionBulkCreateResponse> {
    const res = await api.post<BossQuestionBulkCreateResponse>(
      '/boss-battle/questions/bulk',
      { questions },
    );
    return res.data;
  },
  async bulkUpsertQuestions(
    questions: BulkUpsertBossQuestionInput[],
  ): Promise<BossQuestionBulkUpsertResponse> {
    const res = await api.post<BossQuestionBulkUpsertResponse>(
      '/boss-battle/questions/bulk-upsert',
      { questions },
    );
    return res.data;
  },

  // ---- QuestionSets ----
  async listSets(weekKey: string, grade: number): Promise<BossQuestionSet[]> {
    const res = await api.get<{ success: boolean; sets: BossQuestionSet[] }>(
      '/boss-battle/question-sets',
      { params: { weekKey, grade } },
    );
    return res.data.sets;
  },
  async autoGenerate(
    weekKey: string,
    gradeLevel: number,
    force?: boolean,
  ): Promise<AutoGenerateResult> {
    const res = await api.post<{ success: boolean } & AutoGenerateResult>(
      '/boss-battle/question-sets/auto-generate',
      { weekKey, gradeLevel, force: !!force },
    );
    return res.data;
  },
  async swapQuestion(
    setId: string,
    oldQuestionId: string,
    newQuestionId: string,
  ): Promise<BossQuestionSet> {
    const res = await api.post<{ success: boolean; set: BossQuestionSet }>(
      `/boss-battle/question-sets/${setId}/swap`,
      { oldQuestionId, newQuestionId },
    );
    return res.data.set;
  },

  // ---- Cycle ----
  async initWeek(weekKey: string, grades?: number[]): Promise<InitWeekResult> {
    const res = await api.post<{ success: boolean } & InitWeekResult>(
      '/boss-battle/cycle/init-week',
      { weekKey, grades },
    );
    return res.data;
  },
  async closeWeek(weekKey: string, topN?: number): Promise<CloseWeekResult> {
    const res = await api.post<{ success: boolean } & CloseWeekResult>(
      '/boss-battle/cycle/close-week',
      { weekKey, topN },
    );
    return res.data;
  },
  async expireHonors(): Promise<{ updated: number }> {
    const res = await api.post<{ success: boolean; updated: number }>(
      '/boss-battle/cycle/expire-honors',
    );
    return { updated: res.data.updated };
  },

  // ---- Monitor ----
  async listInstances(weekKey?: string): Promise<BossInstanceMonitorEntry[]> {
    const res = await api.get<{ success: boolean; instances: BossInstanceMonitorEntry[] }>(
      '/boss-battle/instances',
      { params: weekKey ? { weekKey } : {} },
    );
    return res.data.instances;
  },
  async getLeaderboard(weekKey: string, grade: number): Promise<BossLeaderboardResponse> {
    const res = await api.get<{ success: boolean } & BossLeaderboardResponse>(
      '/boss-battle/leaderboard',
      { params: { weekKey, grade } },
    );
    return res.data;
  },
  async getHonors(weekKey: string, grade?: number): Promise<WeeklyHonor[]> {
    const res = await api.get<{ success: boolean; honors: WeeklyHonor[] }>(
      '/boss-battle/honors',
      { params: grade ? { weekKey, grade } : { weekKey } },
    );
    return res.data.honors;
  },

  // ---- Weekly Config (override theo tuần × khối) ----
  async listWeeklyConfigs(weekKey: string, grades?: number[]): Promise<BossWeeklyConfig[]> {
    const params: Record<string, string> = { weekKey };
    if (grades && grades.length > 0) params.grades = grades.join(',');
    const res = await api.get<{ success: boolean; items: BossWeeklyConfig[] }>(
      '/boss-battle/weekly-config',
      { params },
    );
    return res.data.items;
  },
  async getWeeklyConfig(weekKey: string, gradeLevel: number): Promise<BossWeeklyConfig> {
    const res = await api.get<{ success: boolean; item: BossWeeklyConfig }>(
      `/boss-battle/weekly-config/${encodeURIComponent(weekKey)}/${gradeLevel}`,
    );
    return res.data.item;
  },
  async upsertWeeklyConfig(
    weekKey: string,
    gradeLevel: number,
    overrides: BossBattleConfigOverride,
  ): Promise<BossWeeklyConfig> {
    const res = await api.put<{ success: boolean; item: BossWeeklyConfig }>(
      `/boss-battle/weekly-config/${encodeURIComponent(weekKey)}/${gradeLevel}`,
      { overrides },
    );
    return res.data.item;
  },
  async deleteWeeklyConfig(weekKey: string, gradeLevel: number): Promise<boolean> {
    const res = await api.delete<{ success: boolean; removed: boolean }>(
      `/boss-battle/weekly-config/${encodeURIComponent(weekKey)}/${gradeLevel}`,
    );
    return res.data.removed;
  },
  async copyWeeklyConfig(
    sourceWeekKey: string,
    targetWeekKey: string,
    grades?: number[],
    overwrite = false,
  ): Promise<number> {
    const res = await api.post<{ success: boolean; written: number }>(
      '/boss-battle/weekly-config/copy',
      { sourceWeekKey, targetWeekKey, grades, overwrite },
    );
    return res.data.written;
  },
  async listInitializedWeeks(): Promise<string[]> {
    const res = await api.get<{ success: boolean; weeks: string[] }>(
      '/boss-battle/weekly-config/initialized-weeks',
    );
    return res.data.weeks;
  },
};

export default bossBattleService;
