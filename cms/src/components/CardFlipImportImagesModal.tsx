import { useMemo, useState } from 'react';
import { Modal, Radio, Input, Typography, Alert, Space } from 'antd';

const { Text } = Typography;

export type CardFlipImportMode = 'append' | 'overwrite';

interface Props {
  open: boolean;
  /** Số thẻ ảnh đang có (để hiển thị cảnh báo khi Ghi đè) */
  existingImageCount?: number;
  onCancel: () => void;
  /** Trả về danh sách URL hợp lệ + chế độ áp dụng */
  onImport: (urls: string[], mode: CardFlipImportMode) => void;
}

/** Một dòng được coi là URL ảnh hợp lệ nếu là http(s):// hoặc data:image */
function isValidImageUrl(line: string): boolean {
  return /^(https?:\/\/|data:image\/)/i.test(line);
}

export function CardFlipImportImagesModal({
  open,
  existingImageCount = 0,
  onCancel,
  onImport,
}: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CardFlipImportMode>('append');

  const { valid, invalid } = useMemo(() => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      if (isValidImageUrl(line)) valid.push(line);
      else invalid.push(line);
    }
    return { valid, invalid };
  }, [text]);

  const reset = () => {
    setText('');
    setMode('append');
  };

  const handleOk = () => {
    onImport(valid, mode);
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal
      title="Import ảnh thẻ (theo URL)"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={`Import ${valid.length} ảnh`}
      cancelText="Hủy"
      okButtonProps={{ disabled: valid.length === 0 }}
      width={640}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text strong>Chế độ</Text>
          <div style={{ marginTop: 4 }}>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio value="append">Thêm mới (giữ thẻ hiện tại)</Radio>
              <Radio value="overwrite">Ghi đè (thay toàn bộ thẻ hiện tại)</Radio>
            </Radio.Group>
          </div>
        </div>

        {mode === 'overwrite' && (
          <Alert
            type="warning"
            showIcon
            message="Ghi đè sẽ xóa toàn bộ danh sách thẻ hiện tại (bao gồm cả emoji) và thay bằng các ảnh nhập vào. Thay đổi chỉ được lưu khi bạn nhấn 'Lưu cấu hình'."
          />
        )}

        <div>
          <Text strong>Danh sách URL ảnh</Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            Mỗi dòng một URL (http/https hoặc data:image).
          </Text>
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={'https://example.com/1.png\nhttps://example.com/2.png'}
          />
        </div>

        <Text type="secondary">
          {valid.length} URL hợp lệ
          {invalid.length > 0 && ` · ${invalid.length} dòng không hợp lệ (sẽ bỏ qua)`}
          {mode === 'append' && existingImageCount > 0 && ` · đang có ${existingImageCount} thẻ`}
        </Text>

        {invalid.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={`Bỏ qua ${invalid.length} dòng không phải URL ảnh hợp lệ`}
            description={
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {invalid.slice(0, 20).map((l, i) => (
                  <div key={i}>
                    <Text code>{l}</Text>
                  </div>
                ))}
                {invalid.length > 20 && <Text type="secondary">… và {invalid.length - 20} dòng khác</Text>}
              </div>
            }
          />
        )}
      </Space>
    </Modal>
  );
}

export default CardFlipImportImagesModal;
