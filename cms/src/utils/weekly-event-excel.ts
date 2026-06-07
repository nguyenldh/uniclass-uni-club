import * as XLSX from 'xlsx';
import type { CreateExamInput } from '@uniclub/shared';

export interface WeeklyEventExamParseError {
  row: number;
  message: string;
}

export interface WeeklyEventExamParseResult {
  exams: CreateExamInput[];
  errors: WeeklyEventExamParseError[];
}

const HEADER = [
  'examTitle',
  'subject',
  'grade',
  'questionStem',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctKey',
  'shuffleable',
];

/** Tạo template Excel mẫu cho đề thi Weekly Event */
export function generateWeeklyEventExamTemplate(): void {
  const sampleQuestions = Array.from({ length: 25 }, (_, i) => [
    `Đề mẫu khối 5`,           // examTitle
    'Toán',                     // subject
    5,                          // grade
    `Câu hỏi mẫu số ${i + 1}: Nội dung câu hỏi...`, // questionStem
    `Đáp án A câu ${i + 1}`,   // optionA
    `Đáp án B câu ${i + 1}`,   // optionB
    `Đáp án C câu ${i + 1}`,   // optionC
    `Đáp án D câu ${i + 1}`,   // optionD
    ['A', 'B', 'C', 'D'][i % 4], // correctKey
    1,                          // shuffleable
  ]);

  const data = [HEADER, ...sampleQuestions];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'WeeklyEventExams');
  XLSX.writeFile(wb, 'weekly_event_exam_template.xlsx');
}

function parseShuffleable(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  const s = String(v).trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(s);
}

/**
 * Parse file Excel thành danh sách đề thi.
 * Mỗi dòng là 1 câu hỏi. Các dòng có cùng (examTitle, subject, grade) được gộp thành 1 đề.
 * Mỗi đề phải có đúng 25 câu hỏi.
 */
export function parseWeeklyEventExamsFromExcel(file: File): Promise<WeeklyEventExamParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        const errors: WeeklyEventExamParseError[] = [];
        const questionRows: Array<{
          row: number;
          examTitle: string;
          subject: string;
          grade: number;
          stem: string;
          optionA: string;
          optionB: string;
          optionC: string;
          optionD: string;
          correctKey: string;
          shuffleable: boolean;
        }> = [];

        // Parse từng dòng
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 1;
          if (!row || row.length === 0 || (!row[0] && !row[3])) continue;

          const examTitle = String(row[0] || '').trim();
          const subject = String(row[1] || '').trim();
          const grade = parseInt(row[2], 10);
          const stem = String(row[3] || '').trim();
          const optionA = String(row[4] || '').trim();
          const optionB = String(row[5] || '').trim();
          const optionC = String(row[6] || '').trim();
          const optionD = String(row[7] || '').trim();
          const correctKey = String(row[8] || '').trim().toUpperCase();
          const shuffleable = parseShuffleable(row[9]);

          const rowErrors: string[] = [];
          if (!examTitle) rowErrors.push('Thiếu tên đề (examTitle)');
          if (!subject) rowErrors.push('Thiếu môn học (subject)');
          if (isNaN(grade) || grade < 1 || grade > 12) rowErrors.push('grade phải từ 1-12');
          if (!stem) rowErrors.push('Thiếu nội dung câu hỏi (questionStem)');
          if (!optionA || !optionB || !optionC || !optionD) rowErrors.push('Thiếu đáp án (cần đủ A, B, C, D)');
          if (!['A', 'B', 'C', 'D'].includes(correctKey)) rowErrors.push('correctKey phải là A, B, C hoặc D');

          if (rowErrors.length > 0) {
            errors.push({ row: rowNum, message: rowErrors.join('; ') });
            continue;
          }

          questionRows.push({
            row: rowNum,
            examTitle,
            subject,
            grade,
            stem,
            optionA,
            optionB,
            optionC,
            optionD,
            correctKey,
            shuffleable,
          });
        }

        // Gộp câu hỏi thành đề thi theo (examTitle, subject, grade)
        const examMap = new Map<string, typeof questionRows>();

        for (const q of questionRows) {
          const key = `${q.examTitle}|${q.subject}|${q.grade}`;
          if (!examMap.has(key)) {
            examMap.set(key, []);
          }
          examMap.get(key)!.push(q);
        }

        const exams: CreateExamInput[] = [];

        for (const [key, questions] of examMap) {
          const [examTitle, subject, gradeStr] = key.split('|');
          const grade = parseInt(gradeStr, 10);

          if (questions.length !== 25) {
            const firstRow = questions[0].row;
            errors.push({
              row: firstRow,
              message: `Đề "${examTitle}" (khối ${grade}) có ${questions.length}/25 câu — cần đúng 25 câu`,
            });
            continue;
          }

          exams.push({
            grade,
            title: examTitle,
            subject,
            questions: questions.map((q) => ({
              stem: q.stem,
              options: [
                { key: 'A', text: q.optionA },
                { key: 'B', text: q.optionB },
                { key: 'C', text: q.optionC },
                { key: 'D', text: q.optionD },
              ],
              correctKey: q.correctKey,
              shuffleable: q.shuffleable,
            })),
          });
        }

        resolve({ exams, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export danh sách đề thi ra file Excel.
 */
export function exportWeeklyEventExamsToExcel(
  exams: Array<{
    title: string;
    subject: string;
    grade: number;
    questions: Array<{
      stem: string;
      options: Array<{ key: string; text: string }>;
      correctKey: string;
      shuffleable: boolean;
    }>;
  }>,
  filename = 'weekly_event_exams.xlsx',
): void {
  const rows: any[][] = [HEADER];

  for (const exam of exams) {
    for (const q of exam.questions) {
      rows.push([
        exam.title,
        exam.subject,
        exam.grade,
        q.stem,
        q.options.find((o) => o.key === 'A')?.text || '',
        q.options.find((o) => o.key === 'B')?.text || '',
        q.options.find((o) => o.key === 'C')?.text || '',
        q.options.find((o) => o.key === 'D')?.text || '',
        q.correctKey,
        q.shuffleable ? 1 : 0,
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'WeeklyEventExams');
  XLSX.writeFile(wb, filename);
}
