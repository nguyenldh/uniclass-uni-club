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
  Modal,
  Tabs,
} from 'antd';
import { SaveOutlined, SendOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import { weeklyEventService } from '../../services/weekly-event.service';
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

  // Room Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{ grade: number; status: string } | null>(null);
  const [activeTab, setActiveTab] = useState('participants');

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Participants State
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsTotal, setParticipantsTotal] = useState(0);
  const [participantsPage, setParticipantsPage] = useState(1);
  const [participantsPageSize, setParticipantsPageSize] = useState(10);
  const [participantsSearch, setParticipantsSearch] = useState('');

  // Student Answers Modal State
  const [answersModalOpen, setAnswersModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [studentAnswersData, setStudentAnswersData] = useState<{ result: any; answers: any[]; exam: any } | null>(null);
  const [studentAnswersLoading, setStudentAnswersLoading] = useState(false);

  const fetchLeaderboard = async (grade: number) => {
    if (!id) return;
    setLeaderboardLoading(true);
    try {
      const data = await weeklyEventService.getRoomLeaderboard(id, grade);
      setLeaderboard(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Không thể tải bảng xếp hạng');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const fetchParticipants = async (grade: number, page: number, pageSize: number, search: string) => {
    if (!id) return;
    setParticipantsLoading(true);
    try {
      const data = await weeklyEventService.getRoomParticipants(id, grade, {
        page,
        pageSize,
        search: search || undefined,
      });
      setParticipants(data.items);
      setParticipantsTotal(data.total);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Không thể tải danh sách học sinh làm bài');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const fetchStudentAnswers = async (grade: number, studentId: string) => {
    if (!id) return;
    setStudentAnswersLoading(true);
    try {
      const data = await weeklyEventService.getStudentAnswers(id, grade, studentId);
      setStudentAnswersData(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Không thể tải chi tiết bài làm');
    } finally {
      setStudentAnswersLoading(false);
    }
  };

  const handleOpenRoomDetails = (room: { grade: number; status: string }) => {
    setSelectedRoom(room);
    setActiveTab('participants');
    setParticipantsPage(1);
    setParticipantsSearch('');
    setDetailsModalOpen(true);
    fetchParticipants(room.grade, 1, participantsPageSize, '');
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (!selectedRoom) return;
    if (key === 'leaderboard') {
      fetchLeaderboard(selectedRoom.grade);
    } else if (key === 'participants') {
      fetchParticipants(selectedRoom.grade, participantsPage, participantsPageSize, participantsSearch);
    }
  };

  const handlePageChange = (page: number, pageSize?: number) => {
    const size = pageSize || participantsPageSize;
    setParticipantsPage(page);
    setParticipantsPageSize(size);
    if (selectedRoom) {
      fetchParticipants(selectedRoom.grade, page, size, participantsSearch);
    }
  };

  const handleSearch = (value: string) => {
    setParticipantsSearch(value);
    setParticipantsPage(1);
    if (selectedRoom) {
      fetchParticipants(selectedRoom.grade, 1, participantsPageSize, value);
    }
  };

  const handleOpenStudentAnswers = (studentId: string, displayName: string) => {
    if (!selectedRoom) return;
    setSelectedStudentId(studentId);
    setSelectedStudentName(displayName);
    setStudentAnswersData(null);
    setAnswersModalOpen(true);
    fetchStudentAnswers(selectedRoom.grade, studentId);
  };

  const leaderboardColumns = [
    { title: 'Hạng', dataIndex: 'rank', width: 80, render: (r: number) => <strong>#{r}</strong> },
    { title: 'Tên học sinh', dataIndex: 'displayName' },
    { title: 'ID học sinh', dataIndex: 'studentId' },
    { title: 'Số câu đúng', dataIndex: 'correctCount', render: (c: number) => `${c} câu` },
    { title: 'Thời gian', dataIndex: 'totalTimeMs', render: (t: number) => `${(t / 1000).toFixed(1)} giây` },
    { title: 'Điểm', dataIndex: 'score', render: (s: number) => <Tag color="gold">{s} điểm</Tag> },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size="small" type="link" onClick={() => handleOpenStudentAnswers(record.studentId, record.displayName)}>
          Chi tiết bài làm
        </Button>
      ),
    },
  ];

  const participantsColumns = [
    { title: 'Tên học sinh', dataIndex: 'displayName' },
    { title: 'ID học sinh', dataIndex: 'studentId' },
    {
      title: 'Vào phòng',
      dataIndex: 'joinedAt',
      render: (val: string) => val ? new Date(val).toLocaleTimeString('vi-VN') : '-',
    },
    {
      title: 'Bắt đầu làm',
      dataIndex: 'examStartedAt',
      render: (val: string) => val ? new Date(val).toLocaleTimeString('vi-VN') : '-',
    },
    {
      title: 'Nộp bài',
      dataIndex: 'submittedAt',
      render: (val: string, record: any) => {
        if (!val) return <Tag color="blue">Đang làm bài</Tag>;
        const timeStr = new Date(val).toLocaleTimeString('vi-VN');
        const typeStr = record.submissionType === 'manual' ? 'Tự nộp' : 'Hết giờ';
        return (
          <Space direction="vertical" size={0}>
            <span>{timeStr}</span>
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>({typeStr})</span>
          </Space>
        );
      },
    },
    {
      title: 'Mất kết nối',
      dataIndex: 'disconnectCount',
      width: 100,
      render: (c: number) => c > 0 ? <Tag color="red">{c} lần</Tag> : '0',
    },
    {
      title: 'Kết quả',
      key: 'result',
      render: (_: any, record: any) => {
        if (!record.isGraded) return '-';
        return (
          <Space direction="vertical" size={0}>
            <span>Đúng: <strong>{record.correctCount} câu</strong></span>
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>({(record.totalTimeMs / 1000).toFixed(1)}s)</span>
          </Space>
        );
      },
    },
    {
      title: 'Điểm',
      dataIndex: 'score',
      render: (s: number, record: any) => {
        if (!record.isGraded) return '-';
        return <Tag color="gold">{s} điểm</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: any) => {
        if (!record.isGraded) return null;
        return (
          <Button size="small" type="link" onClick={() => handleOpenStudentAnswers(record.studentId, record.displayName)}>
            Chi tiết bài làm
          </Button>
        );
      },
    },
  ];

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

  const isEditable = !!(currentEvent && ['Draft', 'Scheduled'].includes(currentEvent.status));

  const handleSave = async (values: any) => {
    if (!id || !isEditable) return;
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
    if (!id || !isEditable) return;
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

      {!isEditable && (
        <Alert
          type="info"
          showIcon
          message="Sự kiện không thể chỉnh sửa"
          description={
            currentEvent.status === 'Closed'
              ? 'Sự kiện này đã kết thúc. Không thể chỉnh sửa thông tin hoặc gán đề thi.'
              : currentEvent.status === 'Cancelled'
              ? 'Sự kiện này đã bị hủy. Không thể chỉnh sửa thông tin hoặc gán đề thi.'
              : 'Sự kiện đang diễn ra. Không thể chỉnh sửa thông tin hoặc gán đề thi.'
          }
          style={{ marginBottom: 16 }}
        />
      )}

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
            <Form form={form} layout="vertical" onFinish={handleSave} disabled={!isEditable}>
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

              {isEditable && (
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
                  { title: 'Khối', dataIndex: 'grade', width: 50 },
                  {
                    title: 'TT',
                    dataIndex: 'status',
                    width: 80,
                    render: (s: string) => <Tag>{s}</Tag>,
                  },
                  {
                    title: 'Online',
                    dataIndex: 'participantCount',
                    width: 50,
                  },
                  {
                    title: 'Đã nộp',
                    dataIndex: 'submittedCount',
                    width: 50,
                  },
                  {
                    title: 'Hành động',
                    key: 'actions',
                    width: 80,
                    render: (_: any, record: any) => (
                      <Button
                        size="small"
                        type="link"
                        onClick={() => handleOpenRoomDetails(record)}
                      >
                        Chi tiết
                      </Button>
                    ),
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
                  disabled={!isEditable}
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

      {/* Room Details Modal */}
      <Modal
        title={selectedRoom ? `Chi tiết phòng thi — Khối ${selectedRoom.grade}` : 'Chi tiết phòng thi'}
        open={detailsModalOpen}
        onCancel={() => setDetailsModalOpen(false)}
        footer={null}
        width={1000}
      >
        {selectedRoom && (
          <Tabs activeKey={activeTab} onChange={handleTabChange} destroyInactiveTabPane>
            <Tabs.TabPane tab="Danh sách học sinh làm bài" key="participants">
              <div style={{ marginBottom: 16 }}>
                <Input.Search
                  placeholder="Tìm theo tên học sinh hoặc ID..."
                  onSearch={handleSearch}
                  style={{ width: 300 }}
                  allowClear
                />
              </div>
              <Table
                dataSource={participants}
                columns={participantsColumns}
                rowKey="studentId"
                loading={participantsLoading}
                pagination={{
                  current: participantsPage,
                  pageSize: participantsPageSize,
                  total: participantsTotal,
                  onChange: handlePageChange,
                  showSizeChanger: true,
                  showTotal: (total) => `Tổng số: ${total} học sinh`,
                }}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab="Bảng xếp hạng (Top 50)" key="leaderboard">
              <div style={{ marginBottom: 12, color: '#8c8c8c' }}>
                * Hiển thị danh sách 50 học sinh xuất sắc nhất dựa trên điểm số (cao nhất) và thời gian hoàn thành (ngắn nhất).
              </div>
              <Table
                dataSource={leaderboard}
                columns={leaderboardColumns}
                rowKey="studentId"
                loading={leaderboardLoading}
                pagination={false}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>

      {/* Student Answers Modal */}
      <Modal
        title={`Chi tiết bài làm — Học sinh ${selectedStudentName}`}
        open={answersModalOpen}
        onCancel={() => setAnswersModalOpen(false)}
        footer={null}
        width={800}
      >
        {studentAnswersLoading ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : studentAnswersData ? (
          <div>
            <Descriptions title="Tóm tắt kết quả" bordered size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Học sinh">{studentAnswersData.result.displayName} ({studentAnswersData.result.studentId})</Descriptions.Item>
              <Descriptions.Item label="Điểm">{studentAnswersData.result.score} điểm</Descriptions.Item>
              <Descriptions.Item label="Hạng">#{studentAnswersData.result.rank || '-'}</Descriptions.Item>
              <Descriptions.Item label="Số câu đúng">{studentAnswersData.result.correctCount} / {studentAnswersData.result.totalAnswered} câu</Descriptions.Item>
              <Descriptions.Item label="Thời gian">{((studentAnswersData.result.totalTimeMs || 0) / 1000).toFixed(1)} giây</Descriptions.Item>
            </Descriptions>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <Title level={5}>Chi tiết câu hỏi</Title>
              {studentAnswersData.exam.questions.map((question: any, idx: number) => {
                const answer = studentAnswersData.answers.find((a: any) => a.questionId === question.questionId);
                const selectedKey = answer?.selectedKey;
                const isCorrect = answer?.isCorrect;

                return (
                  <Card
                    key={question.questionId}
                    size="small"
                    style={{
                      marginBottom: 12,
                      border: isCorrect ? '1px solid #b7eb8f' : selectedKey ? '1px solid #ffccc7' : '1px solid #f0f0f0',
                      background: isCorrect ? '#f6ffed' : selectedKey ? '#fff2f0' : '#ffffff',
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <strong>Câu {idx + 1}:</strong> <span dangerouslySetInnerHTML={{ __html: question.stem }} />
                      {selectedKey === null && <Tag color="warning" style={{ marginLeft: 8 }}>Không trả lời</Tag>}
                      {selectedKey !== null && (
                        <Tag color={isCorrect ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                          {isCorrect ? 'Đúng' : 'Sai'}
                        </Tag>
                      )}
                    </div>
                    <div style={{ paddingLeft: 12 }}>
                      <Row gutter={[8, 8]}>
                        {question.options.map((opt: any) => {
                          const isOptionCorrect = opt.key === question.correctKey;
                          const isOptionSelected = opt.key === selectedKey;
                          let optColor = 'inherit';
                          let fontWeight = 'normal';
                          if (isOptionCorrect) {
                            optColor = '#52c41a';
                            fontWeight = 'bold';
                          } else if (isOptionSelected) {
                            optColor = '#ff4d4f';
                            fontWeight = 'bold';
                          }

                          return (
                            <Col span={12} key={opt.key}>
                              <span style={{ color: optColor, fontWeight }}>
                                {opt.key}. {opt.text}
                                {isOptionCorrect && ' (Đáp án đúng)'}
                                {isOptionSelected && ' (Học sinh chọn)'}
                              </span>
                            </Col>
                          );
                        })}
                      </Row>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            Không tìm thấy thông tin bài làm.
          </div>
        )}
      </Modal>
    </div>
  );
}
