import { useEffect } from 'react';
import { Modal, Form, InputNumber, Radio, Space } from 'antd';
import type { QuizQuestion, CreateQuizQuestionInput } from '@uniclub/shared';
import { MathPreview, MathSyntaxHint } from './MathText';
import { MathFieldInput } from './MathFieldInput';

interface QuestionFormModalProps {
  open: boolean;
  editingQuestion: QuizQuestion | null;
  onOk: (values: CreateQuizQuestionInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function QuestionFormModal({
  open,
  editingQuestion,
  onOk,
  onCancel,
  loading,
}: QuestionFormModalProps) {
  const [form] = Form.useForm();

  const content = Form.useWatch('content', form);
  const option0 = Form.useWatch('option0', form);
  const option1 = Form.useWatch('option1', form);
  const option2 = Form.useWatch('option2', form);
  const option3 = Form.useWatch('option3', form);
  const correctIndex = Form.useWatch('correctIndex', form);

  useEffect(() => {
    if (open) {
      if (editingQuestion) {
        form.setFieldsValue({
          grade: editingQuestion.grade,
          content: editingQuestion.content,
          option0: editingQuestion.options[0],
          option1: editingQuestion.options[1],
          option2: editingQuestion.options[2],
          option3: editingQuestion.options[3],
          correctIndex: editingQuestion.correctIndex,
          timeLimitSeconds: editingQuestion.timeLimitSeconds,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          timeLimitSeconds: 20,
          correctIndex: 0,
        });
      }
    }
  }, [open, editingQuestion, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onOk({
        grade: values.grade,
        content: values.content,
        options: [values.option0, values.option1, values.option2, values.option3],
        correctIndex: values.correctIndex,
        timeLimitSeconds: values.timeLimitSeconds,
      });
      form.resetFields();
    } catch {
      // validation failed
    }
  };

  return (
    <Modal
      title={editingQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={editingQuestion ? 'Cập nhật' : 'Tạo'}
      cancelText="Hủy"
      width={700}
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

          <Form.Item
            name="timeLimitSeconds"
            label="Thời gian (giây)"
            rules={[{ required: true, message: 'Nhập thời gian' }]}
            style={{ width: 150 }}
          >
            <InputNumber min={5} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        <Form.Item
          name="content"
          label="Nội dung câu hỏi"
          rules={[{ required: true, message: 'Nhập nội dung câu hỏi' }]}
        >
          <MathFieldInput textarea rows={3} placeholder="Nhập nội dung câu hỏi..." />
        </Form.Item>
        <MathSyntaxHint />

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
                    <MathFieldInput placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`} />
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

export default QuestionFormModal;
