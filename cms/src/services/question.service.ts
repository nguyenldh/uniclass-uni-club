import api from './api';
import type {
  QuizQuestion,
  CreateQuizQuestionInput,
  UpdateQuizQuestionInput,
  BulkUpsertQuestionInput,
  QuizQuestionListResponse,
  QuizQuestionBulkCreateResponse,
  QuizQuestionBulkUpsertResponse,
  QuizDifficulty,
} from '@uniclub/shared';

export interface ListQuestionsParams {
  grade?: number;
  difficulty?: QuizDifficulty | 'unknown';
  search?: string;
  page?: number;
  pageSize?: number;
}

export const questionService = {
  /**
   * Lấy danh sách câu hỏi với filter và phân trang
   */
  async list(params: ListQuestionsParams): Promise<QuizQuestionListResponse> {
    const response = await api.get<QuizQuestionListResponse>('/quiz-arena/questions', { params });
    return response.data;
  },

  /**
   * Lấy câu hỏi theo ID
   */
  async getById(id: string): Promise<QuizQuestion> {
    const response = await api.get<{ success: boolean; question: QuizQuestion }>(`/quiz-arena/questions/${id}`);
    return response.data.question;
  },

  /**
   * Tạo câu hỏi mới
   */
  async create(input: CreateQuizQuestionInput): Promise<QuizQuestion> {
    const response = await api.post<{ success: boolean; question: QuizQuestion }>('/quiz-arena/questions', input);
    return response.data.question;
  },

  /**
   * Cập nhật câu hỏi
   */
  async update(id: string, input: UpdateQuizQuestionInput): Promise<QuizQuestion> {
    const response = await api.put<{ success: boolean; question: QuizQuestion }>(`/quiz-arena/questions/${id}`, input);
    return response.data.question;
  },

  /**
   * Xóa câu hỏi
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/quiz-arena/questions/${id}`);
  },

  /**
   * Bulk create câu hỏi (cho Excel import)
   */
  async bulkCreate(questions: CreateQuizQuestionInput[]): Promise<QuizQuestionBulkCreateResponse> {
    const response = await api.post<QuizQuestionBulkCreateResponse>('/quiz-arena/questions/bulk', { questions });
    return response.data;
  },

  /**
   * Bulk upsert câu hỏi (có id thì update, không có id thì create)
   */
  async bulkUpsert(questions: BulkUpsertQuestionInput[]): Promise<QuizQuestionBulkUpsertResponse> {
    const response = await api.post<QuizQuestionBulkUpsertResponse>('/quiz-arena/questions/bulk-upsert', { questions });
    return response.data;
  },
};

export default questionService;
