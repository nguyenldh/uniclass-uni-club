/* ============================================================
   MathFormulaBuilder — hộp thoại tạo công thức toán trực quan.
   Dùng web component <math-field> của MathLive: gõ tự nhiên
   ("1/2" → phân số, "x^2", "sqrt", "pi"...) hoặc dùng bàn phím
   toán ảo. Trả về chuỗi LaTeX (chưa kèm $...$) cho component gọi
   tự bọc & chèn vào ô nhập.
   Xem thêm: https://mathlive.io/mathfield/guides/getting-started/
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { Modal, Typography } from 'antd';
import 'mathlive';
import { MathfieldElement } from 'mathlive';
import { MathText } from './MathText';

const { Text } = Typography;

// MathLive nạp font từ CDN (CMS là công cụ quản trị online) và tắt âm thanh gõ phím.
// Đặt một lần ở cấp module — an toàn khi import lại.
if (typeof window !== 'undefined') {
  try {
    if (!MathfieldElement.fontsDirectory) {
      MathfieldElement.fontsDirectory = 'https://cdn.jsdelivr.net/npm/mathlive@0.110.0/fonts';
    }
    MathfieldElement.soundsDirectory = null;
  } catch {
    /* mathlive chưa sẵn sàng — bỏ qua */
  }
}

export interface MathFormulaBuilderProps {
  open: boolean;
  /** LaTeX ban đầu (khi sửa 1 công thức có sẵn). */
  initial?: string;
  onCancel: () => void;
  onInsert: (latex: string) => void;
}

export function MathFormulaBuilder({ open, initial = '', onCancel, onInsert }: MathFormulaBuilderProps) {
  const mfRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState(initial);

  // Mỗi lần mở: nạp giá trị ban đầu vào math-field + focus.
  useEffect(() => {
    if (!open) return;
    setLatex(initial);
    const mf = mfRef.current;
    if (mf) {
      mf.value = initial;
      requestAnimationFrame(() => mf.focus());
    }
  }, [open, initial]);

  const handleInsert = () => {
    const value = (mfRef.current?.value ?? latex).trim();
    if (value) onInsert(value);
  };

  const trimmed = latex.trim();

  return (
    <Modal
      title="Tạo công thức toán"
      open={open}
      onCancel={onCancel}
      okText="Chèn"
      cancelText="Hủy"
      okButtonProps={{ disabled: !trimmed }}
      onOk={handleInsert}
      width={620}
      destroyOnHidden
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        Gõ trực quan như máy tính bỏ túi: <code>/</code> ra phân số, <code>^</code> ra lũy thừa,
        <code> sqrt</code> ra căn, <code>pi</code>, <code>alpha</code>… Bấm vào ô để hiện bàn phím toán.
      </Text>

      <math-field
        ref={mfRef}
        onInput={(e) => setLatex((e.currentTarget as MathfieldElement).value)}
        style={{
          display: 'block',
          marginTop: 8,
          padding: '12px 14px',
          fontSize: 24,
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          background: '#fff',
        }}
      />

      <div style={{ marginTop: 12 }}>
        <Text strong style={{ fontSize: 13 }}>
          LaTeX
        </Text>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#555',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: '6px 10px',
            marginTop: 4,
            background: '#fafafa',
            minHeight: 30,
            wordBreak: 'break-all',
          }}
        >
          {trimmed || <Text type="secondary">(trống)</Text>}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Text strong style={{ fontSize: 13 }}>
          Hiển thị trong game
        </Text>
        <div
          style={{
            minHeight: 44,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '10px 12px',
            background: '#fafafa',
            marginTop: 4,
            fontSize: 18,
          }}
        >
          {trimmed ? (
            <MathText source={`$${trimmed}$`} />
          ) : (
            <Text type="secondary">Công thức sẽ hiển thị ở đây…</Text>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default MathFormulaBuilder;
