import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Modal,
  Input,
  Form,
  InputNumber,
  DatePicker,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SendOutlined,
  StopOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import type { WeeklyEvent, WeeklyEventStatus } from '@uniclub/shared';
import dayjs from 'dayjs';

const { Title } = Typography;

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

export function WeeklyEventListPage() {
  const navigate = useNavigate();
  const { events, eventsTotal, isLoading, loadEvents, publishEvent, cancelEvent, createEvent } = useWeeklyEventStore();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelEventId, setCancelEventId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  const load = useCallback(() => {
    loadEvents({ status: statusFilter, page, pageSize });
  }, [loadEvents, statusFilter, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async (id: string) => {
    try {
      await publishEvent(id);
      message.success('Đã publish sự kiện');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Publish thất bại');
    }
  };

  const handleCancelClick = (id: string) => {
    setCancelEventId(id);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelEventId) return;
    try {
      await cancelEvent(cancelEventId, cancelReason || 'Admin huỷ');
      message.success('Đã hủy sự kiện');
      setCancelModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Huỷ thất bại');
    }
  };

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      const event = await createEvent({
        weekNumber: values.weekNumber,
        year: values.year,
        title: values.title,
        scheduledStartAt: values.scheduledStartAt.toISOString(),
        activeGrades: values.activeGrades,
      });
      message.success(`Đã tạo sự kiện: ${event.title}`);
      setCreateModalOpen(false);
      createForm.resetFields();
      load();
      // Navigate to detail page
      navigate(`/weekly-event/events/${event._id}`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tạo thất bại');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnsType<WeeklyEvent> = [
    {
      title: 'Tuần',
      dataIndex: 'weekNumber',
      width: 70,
      render: (val: number, record: WeeklyEvent) => `${val}/${record.year}`,
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: 'Thời gian',
      dataIndex: 'scheduledStartAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (status: WeeklyEventStatus) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: 'Khối đã gán đề',
      dataIndex: 'examAssignments',
      width: 120,
      render: (assignments: Record<string, string>, record: WeeklyEvent) => {
        const assigned = Object.keys(assignments || {}).length;
        const total = record.activeGrades.length;
        return `${assigned}/${total}`;
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 250,
      render: (_: unknown, record: WeeklyEvent) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/weekly-event/events/${record._id}`)}
          >
            Chi tiết
          </Button>
          {record.status === 'Draft' && (
            <Popconfirm
              title="Publish sự kiện này?"
              description="Sau khi publish, không thể sửa đề thi đã gán."
              onConfirm={() => handlePublish(record._id!)}
              okText="Publish"
              cancelText="Huỷ"
            >
              <Button size="small" type="primary" icon={<SendOutlined />}>
                Publish
              </Button>
            </Popconfirm>
          )}
          {['Scheduled', 'Waiting', 'InProgress'].includes(record.status) && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancelClick(record._id!)}
            >
              Huỷ
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>Danh sách Sự kiện tuần</Title>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="Lọc trạng thái"
            style={{ width: 200 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Tạo sự kiện mới
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={events}
          rowKey="_id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: eventsTotal,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} sự kiện`,
          }}
        />
      </Card>

      <Modal
        title="Xác nhận huỷ sự kiện"
        open={cancelModalOpen}
        onOk={handleCancelConfirm}
        onCancel={() => setCancelModalOpen(false)}
        okText="Huỷ sự kiện"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc chắn muốn huỷ sự kiện này?</p>
        <Input.TextArea
          placeholder="Lý do huỷ (tuỳ chọn)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
        />
      </Modal>

      <Modal
        title="Tạo sự kiện mới"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={creating}
        okText="Tạo"
        cancelText="Huỷ"
        width={500}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            weekNumber: getCurrentWeekNumber(),
            year: new Date().getFullYear(),
            activeGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          }}
        >
          <Form.Item
            name="title"
            label="Tiêu đề sự kiện"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="VD: Đấu Trường Số 24: Thử Thách Toán Học" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="weekNumber"
              label="Tuần"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={53} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item
              name="year"
              label="Năm"
              rules={[{ required: true }]}
            >
              <InputNumber min={2024} max={2030} style={{ width: 100 }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="scheduledStartAt"
            label="Thời gian bắt đầu"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              style={{ width: '100%' }}
              placeholder="Chọn ngày giờ bắt đầu"
            />
          </Form.Item>

          <Form.Item
            name="activeGrades"
            label="Khối lớp tham gia"
            rules={[{ required: true, message: 'Chọn ít nhất 1 khối' }]}
          >
            <Checkbox.Group
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => ({
                label: `Khối ${g}`,
                value: g,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
