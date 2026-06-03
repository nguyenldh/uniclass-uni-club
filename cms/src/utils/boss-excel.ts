import * as XLSX from 'xlsx';
import type { BulkUpsertBossQuestionInput } from '@uniclub/shared';

export interface BossParseError {
  row: number;
  message: string;
}

export interface BossParseResult {
  rows: BulkUpsertBossQuestionInput[];
  errors: BossParseError[];
}

const HEADER = [
  'id',
  'grade',
  'content',
  'imageUrl',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctIndex',
  'isActive',
];

/** Tạo template Excel mẫu cho BossQuestion */
export function generateBossExcelTemplate(): void {
  const data = [
    HEADER,
    ['', 6, 'Câu hỏi mẫu 1?', '', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 0, 1],
    ['', 7, 'Câu hỏi mẫu 2?', '', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 2, 1],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BossQuestions');
  XLSX.writeFile(wb, 'boss_question_template.xlsx');
}

function parseBool(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  const s = String(v).trim().toLowerCase();
  return !['0', 'false', 'no', 'off', 'tat', 'tắt'].includes(s);
}

/** Parse file Excel thành danh sách BossQuestion để upsert */
export function parseBossQuestionsFromExcel(file: File): Promise<BossParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        const rows: BulkUpsertBossQuestionInput[] = [];
        const errors: BossParseError[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 1;
          if (!row || row.length === 0 || (row[1] === undefined && !row[2])) continue;

          const id = row[0] ? String(row[0]).trim() : undefined;
          const grade = parseInt(row[1], 10);
          const content = String(row[2] || '').trim();
          const imageUrl = row[3] ? String(row[3]).trim() : undefined;
          const optionA = String(row[4] || '').trim();
          const optionB = String(row[5] || '').trim();
          const optionC = String(row[6] || '').trim();
          const optionD = String(row[7] || '').trim();
          const correctIndex = parseInt(row[8], 10);
          const isActive = parseBool(row[9]);

          const rowErrors: string[] = [];
          if (isNaN(grade) || grade < 1 || grade > 12) rowErrors.push('grade phải từ 1-12');
          if (!content) rowErrors.push('content không được rỗng');
          if (!optionA || !optionB || !optionC || !optionD) {
            rowErrors.push('Thiếu đáp án (cần 4 đáp án)');
          }
          if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
            rowErrors.push('correctIndex phải từ 0-3');
          }

          if (rowErrors.length > 0) {
            errors.push({ row: rowNum, message: rowErrors.join('; ') });
            continue;
          }

          const question: BulkUpsertBossQuestionInput = {
            grade,
            content,
            options: [optionA, optionB, optionC, optionD],
            correctIndex,
            isActive,
          };
          if (imageUrl) question.imageUrl = imageUrl;
          if (id) question.id = id;
          rows.push(question);
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

/** Export danh sách BossQuestion ra file Excel */
export function exportBossQuestionsToExcel(
  questions: Array<{
    id?: string;
    grade: number;
    content: string;
    imageUrl?: string;
    options: [string, string, string, string];
    correctIndex: number;
    isActive: boolean;
  }>,
  filename = 'boss_questions.xlsx',
): void {
  const data = [
    HEADER,
    ...questions.map((q) => [
      q.id || '',
      q.grade,
      q.content,
      q.imageUrl || '',
      q.options[0],
      q.options[1],
      q.options[2],
      q.options[3],
      q.correctIndex,
      q.isActive ? 1 : 0,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BossQuestions');
  XLSX.writeFile(wb, filename);
}
