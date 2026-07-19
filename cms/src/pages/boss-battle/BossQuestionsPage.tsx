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
import { bossBattleService } from '../../services/boss-battle.service';
import { exportBossQuestionsToExcel } from '../../utils/boss-excel';
import { BossQuestionFormModal } from '../../components/BossQuestionFormModal';
import { BossImportExcelModal } from '../../components/BossImportExcelModal';
import type { BossQuestion, CreateBossQuestionInput } from '@uniclub/shared';

const { Title } = Typography;

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function BossQuestionsPage() {
  const [questions, setQuestions] = useState<BossQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [filterGrade, setFilterGrade] = useState<number | undefined>();
  const [filterActive, setFilterActive] = useState<boolean | undefined>();
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BossQuestion | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bossBattleService.listQuestions({
        grade: filterGrade,
        isActive: filterActive,
        search: searchText || undefined,
        page,
        pageSize,
      });
      setQuestions(result.items);
      setTotal(result.total);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Không thể tải câu hỏi');
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterActive, searchText, page, pageSize]);

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

  const handleEdit = (question: BossQuestion) => {
    setEditingQuestion(question);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (values: CreateBossQuestionInput) => {
    setFormLoading(true);
    try {
      if (editingQuestion) {
        await bossBattleService.updateQuestion(editingQuestion.id, values);
        message.success('Đã cập nhật câu hỏi');
      } else {
        await bossBattleService.createQuestion(values);
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
      await bossBattleService.deleteQuestion(id);
      message.success('Đã xóa câu hỏi');
      loadQuestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Xóa thất bại');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await bossBattleService.listQuestions({
        grade: filterGrade,
        isActive: filterActive,
        search: searchText || undefined,
        page: 1,
        pageSize: 10000,
      });
      exportBossQuestionsToExcel(result.items, `boss_questions_${Date.now()}.xlsx`);
      message.success(`Đã export ${result.items.length} câu hỏi`);
    } catch {
      message.error('Export thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 20);
  };

  const columns: ColumnsType<BossQuestion> = [
    {
      title: 'Khối',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
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
      title: 'Đáp án đúng',
      dataIndex: 'correctIndex',
      key: 'correctIndex',
      width: 110,
      render: (v: number) => <Tag color="green">{String.fromCharCode(65 + v)}</Tag>,
    },
    {
      title: 'Ảnh',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 60,
      render: (url?: string) =>
        url ? (
          <Tooltip title={url}>
            <Tag color="purple">Có</Tag>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (v: boolean) => (v ? <Tag color="blue">Đang dùng</Tag> : <Tag>Tạm tắt</Tag>),
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Ngân hàng câu hỏi Săn Quái Vật
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
        title="Hướng dẫn import/export câu hỏi Săn Quái Vật"
        open={helpModalOpen}
        onCancel={() => setHelpModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Typography.Paragraph>
            <b>1. Export Excel</b>: Nhấn <b>Export Excel</b> để tải toàn bộ câu hỏi ra file Excel.
            File sẽ có cột <b>id</b> ở đầu.
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>2. Import Excel</b>: Nhấn <b>Import Excel</b> để chọn file Excel và import vào hệ
            thống.
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>3. Quy tắc cập nhật:</b>
            <ul>
              <li>
                <b>Có ID</b>: Nếu ID hợp lệ và tồn tại, hệ thống sẽ <b>cập nhật</b> câu hỏi đó.
              </li>
              <li>
                <b>ID không hợp lệ hoặc không tìm thấy</b>: Hệ thống sẽ <b>tạo mới</b> câu hỏi.
              </li>
              <li>
                <b>Không có ID</b>: Hệ thống sẽ <b>tạo mới</b> câu hỏi.
              </li>
            </ul>
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>Cột trong template:</b>
            <ul>
              <li>
                <b>id</b>: ObjectId (để trống nếu tạo mới).
              </li>
              <li>
                <b>grade</b>: số khối từ 1-12.
              </li>
              <li>
                <b>content</b>: nội dung câu hỏi.
              </li>
              <li>
                <b>imageUrl</b>: URL ảnh (optional).
              </li>
              <li>
                <b>optionA..optionD</b>: 4 đáp án.
              </li>
              <li>
                <b>correctIndex</b>: số từ <b>0</b> đến <b>3</b> (A/B/C/D).
              </li>
              <li>
                <b>isActive</b>: 1 hoặc 0 (mặc định 1 nếu để trống).
              </li>
            </ul>
          </Typography.Paragraph>
          <Typography.Paragraph>
            <b>Lưu ý:</b> Câu hỏi đã đưa vào bộ câu hỏi vẫn được phục vụ kể cả khi sửa hoặc tắt,
            vì server đọc câu hỏi theo ID trong bộ. Tắt chỉ ngăn câu xuất hiện ở những lần
            tạo bộ tự động tiếp theo.
          </Typography.Paragraph>
        </div>
      </Modal>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Khối lớp"
          allowClear
          style={{ width: 140 }}
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
          placeholder="Trạng thái"
          allowClear
          style={{ width: 160 }}
          value={filterActive}
          onChange={(v) => {
            setFilterActive(v);
            setPage(1);
          }}
          options={[
            { label: 'Đang dùng', value: true },
            { label: 'Tạm tắt', value: false },
          ]}
        />

        <Input.Search
          placeholder="Tìm theo nội dung"
          allowClear
          style={{ width: 280 }}
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

      <BossQuestionFormModal
        open={formModalOpen}
        editingQuestion={editingQuestion}
        onOk={handleFormSubmit}
        onCancel={() => setFormModalOpen(false)}
        loading={formLoading}
      />

      <BossImportExcelModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onSuccess={loadQuestions}
      />
    </div>
  );
}

export default BossQuestionsPage;
