import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Radio,
  Switch,
  message,
  Divider,
  Card,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useWeeklyEventStore } from '../stores/weekly-event.store';
import type { ExamBank, ExamQuestion } from '@uniclub/shared';

interface ExamFormModalProps {
  open: boolean;
  exam: ExamBank | null;
  onClose: () => void;
}

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function createEmptyQuestion(): Omit<ExamQuestion, 'questionId'> {
  return {
    stem: '',
    options: [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
    ],
    correctKey: 'A',
    shuffleable: true,
  };
}

export function ExamFormModal({ open, exam, onClose }: ExamFormModalProps) {
  const [form] = Form.useForm();
  const [questions, setQuestions] = useState<Omit<ExamQuestion, 'questionId'>[]>([createEmptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const { createExam, updateExam } = useWeeklyEventStore();

  const isEditing = !!exam;

  useEffect(() => {
    if (open) {
      if (exam) {
        form.setFieldsValue({
          grade: exam.grade,
          title: exam.title,
        });
        setQuestions(exam.questions.map(({ questionId: _qid, ...rest }) => rest));
      } else {
        form.resetFields();
        setQuestions([createEmptyQuestion()]);
      }
    }
  }, [open, exam, form]);

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      message.warning('Đề thi phải có ít nhất 1 câu hỏi');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (field === 'stem') {
        updated[index] = { ...updated[index], stem: value };
      } else if (field === 'correctKey') {
        updated[index] = { ...updated[index], correctKey: value };
      } else if (field === 'shuffleable') {
        updated[index] = { ...updated[index], shuffleable: value };
      } else if (field.startsWith('option_')) {
        const key = field.replace('option_', '');
        const newOptions = updated[index].options.map((opt) =>
          opt.key === key ? { ...opt, text: value } : opt,
        );
        updated[index] = { ...updated[index], options: newOptions };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.stem.trim()) {
          message.error(`Câu ${i + 1}: Vui lòng nhập nội dung câu hỏi`);
          return;
        }
        for (const opt of q.options) {
          if (!opt.text.trim()) {
            message.error(`Câu ${i + 1}: Vui lòng nhập đầy đủ 4 phương án`);
            return;
          }
        }
      }

      setSaving(true);

      const input = {
        grade: values.grade,
        title: values.title,
        questions,
      };

      if (isEditing && exam?._id) {
        await updateExam(exam._id, input);
        message.success('Đã cập nhật đề thi');
      } else {
        await createExam(input);
        message.success('Đã tạo đề thi mới');
      }

      onClose();
    } catch (err: any) {
      if (err.response) {
        message.error(err.response?.data?.error || 'Lưu thất bại');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEditing ? 'Chỉnh sửa đề thi' : 'Tạo đề thi mới'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={saving}
      width={900}
      okText={isEditing ? 'Cập nhật' : 'Tạo mới'}
      cancelText="Huỷ"
    >
      <Form form={form} layout="vertical">
        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            name="grade"
            label="Khối lớp"
            rules={[{ required: true, message: 'Chọn khối lớp' }]}
            style={{ width: 150 }}
          >
            <Select options={GRADE_OPTIONS.map((g) => ({ value: g, label: `Khối ${g}` }))} />
          </Form.Item>
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: 'Nhập tiêu đề' }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="VD: Đề kiểm tra Toán khối 5 - Tuần 12" />
          </Form.Item>
        </Space>
      </Form>

      <Divider orientation="left">
        Câu hỏi ({questions.length} câu)
      </Divider>

      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {questions.map((q, idx) => (
          <Card
            key={idx}
            size="small"
            title={`Câu ${idx + 1}`}
            style={{ marginBottom: 12 }}
            extra={
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveQuestion(idx)}
              />
            }
          >
            <Input.TextArea
              placeholder="Nội dung câu hỏi"
              value={q.stem}
              onChange={(e) => handleQuestionChange(idx, 'stem', e.target.value)}
              rows={2}
              style={{ marginBottom: 8 }}
            />

            {OPTION_KEYS.map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                <Radio
                  checked={q.correctKey === key}
                  onChange={() => handleQuestionChange(idx, 'correctKey', key)}
                />
                <strong>{key}.</strong>
                <Input
                  placeholder={`Phương án ${key}`}
                  value={q.options.find((o) => o.key === key)?.text || ''}
                  onChange={(e) => handleQuestionChange(idx, `option_${key}`, e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            ))}

            <div style={{ marginTop: 4 }}>
              <Switch
                size="small"
                checked={q.shuffleable}
                onChange={(val) => handleQuestionChange(idx, 'shuffleable', val)}
              />{' '}
              <span style={{ fontSize: 12, color: '#888' }}>Cho phép trộn phương án</span>
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddQuestion}
        block
        style={{ marginTop: 12 }}
      >
        Thêm câu hỏi
      </Button>
    </Modal>
  );
}
