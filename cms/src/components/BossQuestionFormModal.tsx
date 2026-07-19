import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Radio, Space, Switch } from 'antd';
import type { BossQuestion, CreateBossQuestionInput } from '@uniclub/shared';
import { MathPreview, MathSyntaxHint } from './MathText';

const { TextArea } = Input;

interface BossQuestionFormModalProps {
  open: boolean;
  editingQuestion: BossQuestion | null;
  onOk: (values: CreateBossQuestionInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function BossQuestionFormModal({
  open,
  editingQuestion,
  onOk,
  onCancel,
  loading,
}: BossQuestionFormModalProps) {
  const [form] = Form.useForm();

  const content = Form.useWatch('content', form);
  const option0 = Form.useWatch('option0', form);
  const option1 = Form.useWatch('option1', form);
  const option2 = Form.useWatch('option2', form);
  const option3 = Form.useWatch('option3', form);
  const correctIndex = Form.useWatch('correctIndex', form);

  useEffect(() => {
    if (!open) return;
    if (editingQuestion) {
      form.setFieldsValue({
        grade: editingQuestion.grade,
        content: editingQuestion.content,
        imageUrl: editingQuestion.imageUrl,
        option0: editingQuestion.options[0],
        option1: editingQuestion.options[1],
        option2: editingQuestion.options[2],
        option3: editingQuestion.options[3],
        correctIndex: editingQuestion.correctIndex,
        isActive: editingQuestion.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ grade: 6, correctIndex: 0, isActive: true });
    }
  }, [open, editingQuestion, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onOk({
        grade: values.grade,
        content: values.content,
        imageUrl: values.imageUrl?.trim() || undefined,
        options: [values.option0, values.option1, values.option2, values.option3],
        correctIndex: values.correctIndex,
        isActive: values.isActive,
      });
      form.resetFields();
    } catch {
      // validation failed
    }
  };

  return (
    <Modal
      title={editingQuestion ? 'Sửa câu hỏi Săn Quái Vật' : 'Thêm câu hỏi Săn Quái Vật'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={editingQuestion ? 'Cập nhật' : 'Tạo'}
      cancelText="Hủy"
      width={700}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            name="grade"
            label="Khối lớp"
            rules={[{ required: true, message: 'Chọn khối lớp' }]}
            style={{ width: 120 }}
          >
            <InputNumber min={1} max={12} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="isActive" label="Đang dùng" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>

        <Form.Item
          name="content"
          label="Nội dung câu hỏi"
          rules={[{ required: true, message: 'Nhập nội dung câu hỏi' }]}
        >
          <TextArea rows={3} placeholder="Nhập nội dung câu hỏi..." />
        </Form.Item>
        <MathSyntaxHint />

        <Form.Item name="imageUrl" label="URL ảnh kèm câu (optional)">
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item
          name="correctIndex"
          label="Đáp án đúng"
          rules={[{ required: true, message: 'Chọn đáp án đúng' }]}
        >
          <Radio.Group>
            <Space direction="vertical" style={{ width: '100%' }}>
              {[0, 1, 2, 3].map((idx) => (
                <Space key={idx} align="start" style={{ width: '100%' }}>
                  <Radio value={idx}>{String.fromCharCode(65 + idx)}.</Radio>
                  <Form.Item
                    name={`option${idx}`}
                    rules={[{ required: true, message: `Nhập đáp án ${String.fromCharCode(65 + idx)}` }]}
                    style={{ marginBottom: 0, flex: 1 }}
                  >
                    <Input placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`} />
                  </Form.Item>
                </Space>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>

        <MathPreview
          question={content}
          options={[option0, option1, option2, option3]}
          correctIndex={correctIndex}
        />
      </Form>
    </Modal>
  );
}

export default BossQuestionFormModal;
