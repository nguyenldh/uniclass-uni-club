/* ============================================================
   MathFieldInput — ô nhập text (Input/TextArea) kèm nút "fx" mở
   trình tạo công thức. Khi chèn, công thức được bọc $...$ và chèn
   đúng vị trí con trỏ trong ô. Lưu dạng string như bình thường.

   Dùng được cả trong Ant <Form.Item> (Form tự truyền value/onChange)
   lẫn controlled qua props value/onChange (vd ExamFormModal state).
   ============================================================ */
import { useRef, useState } from 'react';
import { Input, Button } from 'antd';
import { FunctionOutlined } from '@ant-design/icons';
import { MathFormulaBuilder } from './MathFormulaBuilder';

const { TextArea } = Input;

export interface MathFieldInputProps {
  value?: string;
  onChange?: (value: string) => void;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
}

export function MathFieldInput({
  value = '',
  onChange,
  textarea = false,
  rows = 3,
  placeholder,
  id,
}: MathFieldInputProps) {
  const [open, setOpen] = useState(false);
  const domRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const sel = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const captureSel = () => {
    const el = domRef.current;
    if (el) {
      sel.current = {
        start: el.selectionStart ?? value.length,
        end: el.selectionEnd ?? value.length,
      };
    }
  };

  const handleInsert = (latex: string) => {
    const wrapped = `$${latex}$`;
    const { start, end } = sel.current;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    onChange?.(next);
    setOpen(false);
    const pos = start + wrapped.length;
    requestAnimationFrame(() => {
      const el = domRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        sel.current = { start: pos, end: pos };
      }
    });
  };

  const openBuilder = () => {
    captureSel();
    setOpen(true);
  };

  const fieldEvents = {
    value,
    id,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    onSelect: captureSel,
    onKeyUp: captureSel,
    onClick: captureSel,
    onBlur: captureSel,
  };

  return (
    <>
      {textarea ? (
        <div>
          <TextArea
            {...fieldEvents}
            ref={(r: any) => {
              domRef.current = r?.resizableTextArea?.textArea ?? null;
            }}
            rows={rows}
          />
          <div style={{ marginTop: 4 }}>
            <Button size="small" icon={<FunctionOutlined />} onClick={openBuilder}>
              Chèn công thức
            </Button>
          </div>
        </div>
      ) : (
        <Input
          {...fieldEvents}
          ref={(r: any) => {
            domRef.current = r?.input ?? null;
          }}
          addonAfter={
            <FunctionOutlined
              title="Chèn công thức toán"
              style={{ cursor: 'pointer' }}
              onClick={openBuilder}
            />
          }
        />
      )}

      <MathFormulaBuilder open={open} onCancel={() => setOpen(false)} onInsert={handleInsert} />
    </>
  );
}

export default MathFieldInput;
