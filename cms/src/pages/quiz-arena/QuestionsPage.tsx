import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Select,
  Input,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { questionService } from '../../services/question.service';
import { exportQuestionsToExcel } from '../../utils/excel';
import { QuestionFormModal } from '../../components/QuestionFormModal';
import { ImportExcelModal } from '../../components/ImportExcelModal';
import type { QuizQuestion, QuizDifficulty, CreateQuizQuestionInput } from '@uniclub/shared';

const { Title } = Typography;

const GRADES = [6, 7, 8, 9, 10, 11, 12];

const difficultyColors: Record<string, string> = {
  easy: 'green',
  medium: 'orange',
  hard: 'red',
};

const difficultyLabels: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
  unknown: 'Chưa xác định',
};

export function QuestionsPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | undefined>();
  const [filterDifficulty, setFilterDifficulty] = useState<QuizDifficulty | 'unknown' | undefined>();
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await questionService.list({
        grade: filterGrade,
        difficulty: filterDifficulty,
        search: searchText || undefined,
        page,
        pageSize,
      });
      setQuestions(result.questions);
      setTotal(result.total);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Không thể tải câu hỏi');
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterDifficulty, searchText, page, pageSize]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleSearch = () => {
    setSearchText(searchInput);
    setPage(1);
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setFormModalOpen(true);
  };

  const handleEdit = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (values: CreateQuizQuestionInput) => {
    setFormLoading(true);
    try {
      if (editingQuestion) {
        await questionService.update(editingQuestion.id, values);
        message.success('Đã cập nhật câu hỏi');
      } else {
        await questionService.create(values);
        message.success('Đã tạo câu hỏi mới');
      }
      setFormModalOpen(false);
      loadQuestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Thao tác thất bại');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await questionService.delete(id);
      message.success('Đã xóa câu hỏi');
      loadQuestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Xóa thất bại');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Lấy tất cả câu hỏi theo filter hiện tại (không giới hạn page)
      const result = await questionService.list({
        grade: filterGrade,
        difficulty: filterDifficulty,
        search: searchText || undefined,
        page: 1,
        pageSize: 10000, // max
      });
      exportQuestionsToExcel(result.questions, `questions_${Date.now()}.xlsx`);
      message.success(`Đã export ${result.questions.length} câu hỏi`);
    } catch (err: any) {
      message.error('Export thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 20);
  };

  const columns: ColumnsType<QuizQuestion> = [
    {
      title: 'Khối',
      dataIndex: 'grade',
      key: 'grade',
      width: 60,
      render: (grade: number) => <Tag>{grade}</Tag>,
    },
    {
      title: 'Nội dung',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Tooltip title={content}>
          <span>{content}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Độ khó',
      dataIndex: 'difficultyBucket',
      key: 'difficultyBucket',
      width: 120,
      render: (difficulty: QuizDifficulty | null) =>
        difficulty ? (
          <Tag color={difficultyColors[difficulty]}>{difficultyLabels[difficulty]}</Tag>
        ) : (
          <Tag>{difficultyLabels.unknown}</Tag>
        ),
    },
    {
      title: 'Tỷ lệ đúng',
      dataIndex: 'correctRate',
      key: 'correctRate',
      width: 100,
      render: (rate: number | null) => (rate !== null ? `${(rate * 100).toFixed(1)}%` : '-'),
    },
    {
      title: 'Số lượt',
      dataIndex: 'totalAttempts',
      key: 'totalAttempts',
      width: 80,
    },
    {
      title: 'Thời gian',
      dataIndex: 'timeLimitSeconds',
      key: 'timeLimitSeconds',
      width: 80,
      render: (s: number) => `${s}s`,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Xóa câu hỏi này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Ngân hàng câu hỏi
        </Title>
        <Space>
          <Button icon={<InfoCircleOutlined />} onClick={() => setHelpModalOpen(true)}>
            Hướng dẫn import/export
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
            Thêm câu hỏi
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            Import Excel
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            Export Excel
          </Button>
        </Space>
      </div>

      <Modal
        title="Hướng dẫn import/export câu hỏi"
        open={helpModalOpen}
        onCancel={() => setHelpModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Typography.Paragraph>
            <b>1. Export Excel</b>: Nhấn <b>Export Excel</b> để tải toàn bộ câu hỏi ra file Excel. File sẽ có cột <b>ID</b> ở đầu.
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>2. Import Excel</b>: Nhấn <b>Import Excel</b> để chọn file Excel và import lại vào hệ thống.
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>3. Quy tắc cập nhật:</b>
            <ul>
              <li><b>Có ID</b>: Nếu ID hợp lệ và tồn tại, hệ thống sẽ <b>cập nhật</b> câu hỏi đó.</li>
              <li><b>ID không hợp lệ hoặc không tìm thấy</b>: Hệ thống sẽ <b>tạo mới</b> câu hỏi.</li>
              <li><b>Không có ID</b>: Hệ thống sẽ <b>tạo mới</b> câu hỏi.</li>
            </ul>
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>Lưu ý:</b>
            <ul>
              <li>Không tự động xóa câu hỏi khi xóa dòng trong Excel.</li>
              <li>Chỉ sửa các cột nội dung, đáp án, thời gian, khối lớp.</li>
              <li>Hệ thống sẽ báo lỗi chi tiết nếu có dòng không hợp lệ.</li>
              <li><b>correctIndex</b> phải là số từ <b>0</b> đến <b>3</b> (tương ứng đáp án A, B, C, D).</li>
            </ul>
          </Typography.Paragraph>
        </div>
      </Modal>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Khối lớp"
          allowClear
          style={{ width: 120 }}
          value={filterGrade}
          onChange={(v) => {
            setFilterGrade(v);
            setPage(1);
          }}
        >
          {GRADES.map((g) => (
            <Select.Option key={g} value={g}>
              Khối {g}
            </Select.Option>
          ))}
        </Select>

        <Select
          placeholder="Độ khó"
          allowClear
          style={{ width: 150 }}
          value={filterDifficulty}
          onChange={(v) => {
            setFilterDifficulty(v);
            setPage(1);
          }}
        >
          <Select.Option value="easy">{difficultyLabels.easy}</Select.Option>
          <Select.Option value="medium">{difficultyLabels.medium}</Select.Option>
          <Select.Option value="hard">{difficultyLabels.hard}</Select.Option>
          <Select.Option value="unknown">{difficultyLabels.unknown}</Select.Option>
        </Select>

        <Input.Search
          placeholder="Tìm theo nội dung"
          allowClear
          style={{ width: 250 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={handleSearch}
          enterButton={<SearchOutlined />}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={questions}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Tổng ${t} câu hỏi`,
        }}
        onChange={handleTableChange}
      />

      <QuestionFormModal
        open={formModalOpen}
        editingQuestion={editingQuestion}
        onOk={handleFormSubmit}
        onCancel={() => setFormModalOpen(false)}
        loading={formLoading}
      />

      <ImportExcelModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onSuccess={loadQuestions}
      />
    </div>
  );
}

export default QuestionsPage;
