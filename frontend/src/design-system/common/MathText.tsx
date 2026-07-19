/* ============================================================
   MathText — render nội dung câu hỏi / đáp án có công thức toán.
   Dùng chung cho cả 3 game (So Tài, Săn Quái Vật, Sự kiện tuần).

   Cú pháp nhập (LaTeX, lưu thẳng trong string sẵn có):
     $...$   → công thức inline   (vd: $\frac{1}{2}$, $x^2$, $\sqrt{2}$)
     $$...$$ → công thức block
     \$      → dấu đô-la thường
   Text không có "$" → render y như cũ (giữ xuống dòng qua CSS pre-line).
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

    // \$ → dấu đô-la thường (không mở công thức)
    if (ch === '\\' && input[i + 1] === '$') {
      text += '$';
      i += 2;
      continue;
    }

    if (ch === '$') {
      const block = input[i + 1] === '$';
      const delim = block ? '$$' : '$';
      const start = i + delim.length;

      // Tìm delimiter đóng, bỏ qua ký tự đã escape (\x) bên trong công thức.
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

      // Không có delimiter đóng → coi "$" là ký tự thường.
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
  /** Nội dung: string → parse công thức; ReactNode khác → render nguyên trạng. */
  source?: ReactNode;
}

/** Render text + công thức toán. Không phải string thì trả nguyên (an toàn cho ReactNode). */
export function MathText({ source }: MathTextProps) {
  if (typeof source !== 'string') return <>{source}</>;

  const text = normalizeNewlines(source);
  if (!text.includes('$')) return <>{text}</>;

  return (
    <>
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
    </>
  );
}

export default MathText;
