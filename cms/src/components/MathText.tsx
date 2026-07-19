/* ============================================================
   MathText / MathPreview — render + preview công thức toán trong CMS.
   Dùng cho form nhập câu hỏi của cả 3 game (So Tài, Săn Quái Vật,
   Sự kiện tuần). Đồng bộ cú pháp với frontend design-system/common/MathText.

   Cú pháp nhập (LaTeX, lưu thẳng trong string):
     $...$   → công thức inline   (vd: $\frac{1}{2}$, $x^2$, $\sqrt{2}$)
     $$...$$ → công thức block
     \$      → dấu đô-la thường
   ============================================================ */
import { Fragment, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Đổi ký tự "\n" dạng literal (từ import Excel/JSON) thành xuống dòng thật. */
const normalizeNewlines = (s: string): string => s.replace(/\\r\\n|\\r|\\n/g, '\n');

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string; block: boolean };

/** Tách chuỗi thành các đoạn text và công thức toán ($...$ / $$...$$). */
export function parseMath(input: string): Segment[] {
  const segments: Segment[] = [];
  let text = '';
  let i = 0;

  const flushText = () => {
    if (text) {
      segments.push({ type: 'text', value: text });
      text = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && input[i + 1] === '$') {
      text += '$';
      i += 2;
      continue;
    }

    if (ch === '$') {
      const block = input[i + 1] === '$';
      const delim = block ? '$$' : '$';
      const start = i + delim.length;

      let end = -1;
      for (let j = start; j < input.length; j++) {
        if (input[j] === '\\') {
          j++;
          continue;
        }
        if (block ? input[j] === '$' && input[j + 1] === '$' : input[j] === '$') {
          end = j;
          break;
        }
      }

      if (end === -1) {
        text += ch;
        i += 1;
        continue;
      }

      flushText();
      segments.push({ type: 'math', value: input.slice(start, end), block });
      i = end + delim.length;
      continue;
    }

    text += ch;
    i += 1;
  }

  flushText();
  return segments;
}

function renderTex(tex: string, block: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode: block,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return tex;
  }
}

export interface MathTextProps {
  source?: ReactNode;
}

/** Render text + công thức toán. Không phải string thì trả nguyên. */
export function MathText({ source }: MathTextProps) {
  if (typeof source !== 'string') return <>{source}</>;

  const text = normalizeNewlines(source);
  if (!text.includes('$')) return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>;

  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {parseMath(text).map((seg, idx) =>
        seg.type === 'text' ? (
          <Fragment key={idx}>{seg.value}</Fragment>
        ) : (
          <span
            key={idx}
            dangerouslySetInnerHTML={{ __html: renderTex(seg.value, seg.block) }}
          />
        )
      )}
    </span>
  );
}

/** Dòng gợi ý cú pháp nhập công thức — hiện dưới mỗi form. */
export function MathSyntaxHint() {
  return (
    <div style={{ fontSize: 12, color: '#888', marginTop: -4, marginBottom: 8 }}>
      Dùng <code>$...$</code> để nhập công thức, ví dụ <code>{'$\\frac{a}{b}$'}</code>,{' '}
      <code>{'$x^2$'}</code>, <code>{'$\\sqrt{2}$'}</code>.
    </div>
  );
}

export interface MathPreviewProps {
  question?: string;
  options?: Array<string | undefined>;
  /** Chỉ số đáp án đúng (0-based) để tô xanh trong preview. */
  correctIndex?: number;
  title?: string;
}

/** Khung xem trước câu hỏi + đáp án như học sinh sẽ thấy (đã render công thức). */
export function MathPreview({ question, options, correctIndex, title = 'Xem trước' }: MathPreviewProps) {
  const hasContent =
    (question && question.trim()) || (options ?? []).some((o) => o && o.trim());
  if (!hasContent) return null;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 12,
        background: '#fafafa',
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>{title}</div>
      {question && question.trim() && (
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          <MathText source={question} />
        </div>
      )}
      {(options ?? []).map((opt, idx) =>
        opt && opt.trim() ? (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 6,
              padding: '2px 0',
              color: idx === correctIndex ? '#16a34a' : undefined,
              fontWeight: idx === correctIndex ? 600 : undefined,
            }}
          >
            <span>{String.fromCharCode(65 + idx)}.</span>
            <MathText source={opt} />
          </div>
        ) : null
      )}
    </div>
  );
}

export default MathText;
