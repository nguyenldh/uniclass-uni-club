import { useEffect, useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Card,
  message,
  Spin,
  Typography,
  Divider,
  Select,
  Table,
  Tag,
  Space,
  DatePicker,
  Checkbox,
  Alert,
  Row,
  Col,
  Descriptions,
} from 'antd';
import { SaveOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import type { WeeklyEvent, WeeklyEventStatus, ExamBank } from '@uniclub/shared';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const STATUS_COLOR: Record<WeeklyEventStatus, string> = {
  Draft: 'default',
  Scheduled: 'blue',
  Waiting: 'cyan',
  InProgress: 'green',
  Grading: 'orange',
  Showing: 'purple',
  Closed: 'default',
  Cancelled: 'red',
};

const STATUS_LABEL: Record<WeeklyEventStatus, string> = {
  Draft: 'Bản nháp',
  Scheduled: 'Đã lên lịch',
  Waiting: 'Đang chờ',
  InProgress: 'Đang thi',
  Grading: 'Đang chấm',
  Showing: 'Hiển thị BXH',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
};

export function WeeklyEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [examOptions, setExamOptions] = useState<Record<number, ExamBank[]>>({});
  const [assigningGrade, setAssigningGrade] = useState<Record<number, string>>({});

  const {
    currentEvent,
    rooms,
    isLoading,
    loadEvent,
    updateEvent,
    publishEvent,
    assignExam,
    loadRooms,
    loadExamsByGrade,
  } = useWeeklyEventStore();

  useEffect(() => {
    if (id) {
      loadEvent(id);
      loadRooms(id);
    }
  }, [id, loadEvent, loadRooms]);

  // Load exam options for each active grade
  useEffect(() => {
    if (currentEvent) {
      currentEvent.activeGrades.forEach(async (grade) => {
        const exams = await loadExamsByGrade(grade);
        setExamOptions((prev) => ({ ...prev, [grade]: exams }));
      });
    }
  }, [currentEvent, loadExamsByGrade]);

  useEffect(() => {
    if (currentEvent) {
      form.setFieldsValue({
        title: currentEvent.title,
        scheduledStartAt: currentEvent.scheduledStartAt ? dayjs(currentEvent.scheduledStartAt) : null,
        waitingDuration: currentEvent.waitingDuration,
        examDuration: currentEvent.examDuration,
        leaderboardDuration: currentEvent.leaderboardDuration,
        questionCountOverride: currentEvent.questionCountOverride,
        activeGrades: currentEvent.activeGrades,
      });
      // Set current exam assignments
      const assignments = currentEvent.examAssignments || {};
      const initAssigning: Record<number, string> = {};
      Object.entries(assignments).forEach(([grade, examId]) => {
        initAssigning[Number(grade)] = examId;
      });
      setAssigningGrade(initAssigning);
    }
  }, [currentEvent, form]);

  const isLive = !!(currentEvent && ['Waiting', 'InProgress', 'Grading', 'Showing'].includes(currentEvent.status));

  const handleSave = async (values: any) => {
    if (!id) return;
    setSaving(true);
    try {
      await updateEvent(id, {
        title: values.title,
        scheduledStartAt: values.scheduledStartAt?.toISOString(),
        waitingDuration: values.waitingDuration,
        examDuration: values.examDuration,
        leaderboardDuration: values.leaderboardDuration,
        questionCountOverride: values.questionCountOverride,
        activeGrades: values.activeGrades,
      });
      message.success('Đã lưu sự kiện');
      // Reload rooms vì activeGrades có thể đã thay đổi
      loadRooms(id);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await publishEvent(id);
      message.success('Đã publish sự kiện');
      loadEvent(id);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Publish thất bại');
    } finally {
      setPublishing(false);
    }
  };

  const handleAssignExam = async (grade: number, examId: string) => {
    if (!id) return;
    try {
      await assignExam(id, { grade, examId });
      setAssigningGrade((prev) => ({ ...prev, [grade]: examId }));
      message.success(`Đã gán đề cho khối ${grade}`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Gán đề thất bại');
    }
  };

  if (isLoading && !currentEvent) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentEvent) {
    return <div>Không tìm thấy sự kiện</div>;
  }

  const allGradesAssigned = currentEvent.activeGrades.every(
    (g) => currentEvent.examAssignments?.[String(g)],
  );

  return (
    <div>
      <Title level={4}>
        Chi tiết Sự kiện tuần
        <Tag color={STATUS_COLOR[currentEvent.status]} style={{ marginLeft: 12 }}>
          {STATUS_LABEL[currentEvent.status]}
        </Tag>
      </Title>

      {currentEvent.status === 'Draft' && !allGradesAssigned && (
        <Alert
          type="warning"
          showIcon
          message="Chưa gán đề cho tất cả các khối"
          description="Cần gán đề cho tất cả các khối đang active trước khi publish."
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title="Thông tin sự kiện">
            <Form form={form} layout="vertical" onFinish={handleSave} disabled={isLive}>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
                <Input />
              </Form.Item>

              <Form.Item name="scheduledStartAt" label="Thời gian bắt đầu" rules={[{ required: true }]}>
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="waitingDuration" label="Chờ (phút)" rules={[{ required: true }]}>
                    <InputNumber min={1} max={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="examDuration" label="Làm bài (phút)" rules={[{ required: true }]}>
                    <InputNumber min={5} max={60} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="leaderboardDuration" label="BXH (phút)" rules={[{ required: true }]}>
                    <InputNumber min={1} max={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="questionCountOverride" label="Số câu hỏi">
                <InputNumber min={5} max={50} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="activeGrades" label="Khối lớp tham gia" rules={[{ required: true }]}>
                <Checkbox.Group options={GRADE_OPTIONS.map((g) => ({ label: `Khối ${g}`, value: g }))} />
              </Form.Item>

              {!isLive && (
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                      Lưu thay đổi
                    </Button>
                    {currentEvent.status === 'Draft' && (
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={publishing}
                        onClick={handlePublish}
                        disabled={!allGradesAssigned}
                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      >
                        Publish sự kiện
                      </Button>
                    )}
                  </Space>
                </Form.Item>
              )}
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Trạng thái phòng thi">
            {rooms.length === 0 ? (
              <Text type="secondary">Đang tải...</Text>
            ) : (
              <Table
                dataSource={rooms}
                rowKey="grade"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Khối', dataIndex: 'grade', width: 60 },
                  {
                    title: 'TT',
                    dataIndex: 'status',
                    width: 100,
                    render: (s: string) => <Tag>{s}</Tag>,
                  },
                  {
                    title: 'Online',
                    dataIndex: 'participantCount',
                    width: 60,
                  },
                  {
                    title: 'Đã nộp',
                    dataIndex: 'submittedCount',
                    width: 60,
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Gán đề theo khối" style={{ marginTop: 16 }}>
        <Table
          dataSource={currentEvent.activeGrades.map((grade) => ({
            grade,
            examId: assigningGrade[grade] || currentEvent.examAssignments?.[String(grade)] || '',
          }))}
          rowKey="grade"
          pagination={false}
          columns={[
            { title: 'Khối', dataIndex: 'grade', width: 80 },
            {
              title: 'Đề thi',
              dataIndex: 'examId',
              render: (examId: string, record: { grade: number }) => (
                <Select
                  showSearch
                  placeholder="Chọn đề thi"
                  style={{ width: '100%' }}
                  value={examId || undefined}
                  onChange={(val) => handleAssignExam(record.grade, val)}
                  disabled={isLive}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={(examOptions[record.grade] || []).map((e) => ({
                    value: e._id,
                    label: `${e.title} (${e.subject}, ${e.totalQuestions} câu)`,
                  }))}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
