import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Modal,
  Input,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import { ExamFormModal } from '../../components/ExamFormModal';
import { WeeklyEventImportExcelModal } from '../../components/WeeklyEventImportExcelModal';
import type { ExamBank } from '@uniclub/shared';

const { Title } = Typography;

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function WeeklyEventExamBankPage() {
  const { exams, examsTotal, isLoading, loadExams, deleteExam } = useWeeklyEventStore();
  const [gradeFilter, setGradeFilter] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamBank | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const load = useCallback(() => {
    loadExams({
      grade: gradeFilter,
      search: searchText || undefined,
      page,
      pageSize,
    });
  }, [loadExams, gradeFilter, searchText, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = () => {
    setEditingExam(null);
    setModalOpen(true);
  };

  const handleEdit = (exam: ExamBank) => {
    setEditingExam(exam);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExam(id);
      message.success('Đã xóa đề thi');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Xóa thất bại');
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingExam(null);
    load();
  };

  const columns: ColumnsType<ExamBank> = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: 'Khối',
      dataIndex: 'grade',
      width: 80,
    },
    {
      title: 'Số câu',
      dataIndex: 'totalQuestions',
      width: 80,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 160,
      render: (val: string) => val ? new Date(val).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: ExamBank) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa đề thi này?"
            onConfirm={() => handleDelete(record._id!)}
            okText="Xóa"
            cancelText="Huỷ"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>Ngân hàng đề — Sự kiện tuần</Title>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Select
              allowClear
              placeholder="Lọc khối"
              style={{ width: 120 }}
              value={gradeFilter}
              onChange={(val) => {
                setGradeFilter(val);
                setPage(1);
              }}
              options={GRADE_OPTIONS.map((g) => ({ value: g, label: `Khối ${g}` }))}
            />
            <Input.Search
              placeholder="Tìm kiếm..."
              style={{ width: 250 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={() => {
                setPage(1);
                load();
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>
              Làm mới
            </Button>
          </Space>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Tạo đề mới
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
              Import Excel
            </Button>
          </Space>
        </Space>

        <Table
          columns={columns}
          dataSource={exams}
          rowKey="_id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: examsTotal,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đề`,
          }}
        />
      </Card>

      <ExamFormModal
        open={modalOpen}
        exam={editingExam}
        onClose={handleModalClose}
      />

      <WeeklyEventImportExcelModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
