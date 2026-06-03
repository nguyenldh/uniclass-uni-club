import * as XLSX from 'xlsx';
import type { BulkUpsertQuestionInput } from '@uniclub/shared';

export interface ParsedRow {
  id?: string;
  grade: number;
  content: string;
  options: [string, string, string, string];
  correctIndex: number;
  timeLimitSeconds: number;
}

export interface ParseError {
  row: number; // 1-indexed
  message: string;
}

export interface ParseResult {
  rows: BulkUpsertQuestionInput[];
  errors: ParseError[];
}

/**
 * Tạo template Excel mẫu
 */
export function generateExcelTemplate(): void {
  const data = [
    ['id', 'grade', 'content', 'optionA', 'optionB', 'optionC', 'optionD', 'correctIndex', 'timeLimitSeconds'],
    ['', 10, 'Câu hỏi mẫu 1?', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 0, 20],
    ['', 10, 'Câu hỏi mẫu 2?', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 1, 30],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'question_template.xlsx');
}

/**
 * Parse file Excel thành danh sách câu hỏi
 */
export function parseQuestionsFromExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        const rows: BulkUpsertQuestionInput[] = [];
        const errors: ParseError[] = [];

        // Skip header row
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 1; // 1-indexed for display

          // Skip empty rows
          if (!row || row.length === 0 || !row[1]) continue;

          const id = row[0] ? String(row[0]).trim() : undefined;
          const grade = parseInt(row[1], 10);
          const content = String(row[2] || '').trim();
          const optionA = String(row[3] || '').trim();
          const optionB = String(row[4] || '').trim();
          const optionC = String(row[5] || '').trim();
          const optionD = String(row[6] || '').trim();
          const correctIndex = parseInt(row[7], 10);
          const timeLimitSeconds = parseInt(row[8], 10) || 20;

          // Validate
          const rowErrors: string[] = [];

          if (isNaN(grade) || grade < 1 || grade > 12) {
            rowErrors.push('grade phải từ 1-12');
          }
          if (!content) {
            rowErrors.push('content không được rỗng');
          }
          if (!optionA || !optionB || !optionC || !optionD) {
            rowErrors.push('Thiếu đáp án (cần 4 đáp án)');
          }
          if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
            rowErrors.push('correctIndex phải từ 0-3');
          }
          if (isNaN(timeLimitSeconds) || timeLimitSeconds < 5) {
            rowErrors.push('timeLimitSeconds phải >= 5');
          }

          if (rowErrors.length > 0) {
            errors.push({ row: rowNum, message: rowErrors.join('; ') });
          } else {
            const question: BulkUpsertQuestionInput = {
              grade,
              content,
              options: [optionA, optionB, optionC, optionD],
              correctIndex,
              timeLimitSeconds,
            };
            if (id) question.id = id;
            rows.push(question);
          }
        }

        resolve({ rows, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export danh sách câu hỏi ra file Excel
 */
export function exportQuestionsToExcel(
  questions: Array<{
    id?: string;
    grade: number;
    content: string;
    options: [string, string, string, string];
    correctIndex: number;
    timeLimitSeconds: number;
  }>,
  filename = 'questions.xlsx',
): void {
  const data = [
    ['id', 'grade', 'content', 'optionA', 'optionB', 'optionC', 'optionD', 'correctIndex', 'timeLimitSeconds'],
    ...questions.map((q) => [
      q.id || '',
      q.grade,
      q.content,
      q.options[0],
      q.options[1],
      q.options[2],
      q.options[3],
      q.correctIndex,
      q.timeLimitSeconds,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, filename);
}
