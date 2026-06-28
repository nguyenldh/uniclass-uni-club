import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Avatar,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { botProfileService } from '../services/bot-profile.service';
import type { BotProfile, CreateBotProfileInput } from '@uniclub/shared';

const { Title } = Typography;

export function BotProfilesPage() {
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BotProfile | null>(null);
  const [form] = Form.useForm();

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await botProfileService.getAll();
      setProfiles(data);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Không thể tải danh sách bot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = () => {
    setEditingProfile(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalVisible(true);
  };

  const handleEdit = (profile: BotProfile) => {
    setEditingProfile(profile);
    form.setFieldsValue(profile);
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingProfile) {
        await botProfileService.update(editingProfile.id, values);
        message.success('Đã cập nhật bot profile');
      } else {
        await botProfileService.create(values as CreateBotProfileInput);
        message.success('Đã tạo bot profile mới');
      }
      setModalVisible(false);
      loadProfiles();
    } catch (error: any) {
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await botProfileService.delete(id);
      message.success('Đã xóa bot profile');
      loadProfiles();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Xóa thất bại');
    }
  };

  const handleToggleActive = async (profile: BotProfile) => {
    try {
      await botProfileService.toggleActive(profile.id);
      message.success(`Bot "${profile.name}" đã ${profile.isActive ? 'bị vô hiệu hóa' : 'được kích hoạt'}`);
      loadProfiles();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Toggle thất bại');
    }
  };

  const handleRefreshCache = async () => {
    try {
      const count = await botProfileService.refreshCache();
      message.success(`Đã refresh cache (${count} bots)`);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Refresh cache thất bại');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const count = await botProfileService.seedDefaults();
      message.success(`Đã seed ${count} bots mặc định`);
      loadProfiles();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Seed thất bại');
    }
  };

  const columns: ColumnsType<BotProfile> = [
    {
      title: 'Avatar',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 80,
      render: (avatar: string, record) => (
        <Avatar src={avatar || undefined} size={40}>
          {record.name?.trim().charAt(0).toUpperCase() || 'B'}
        </Avatar>
      ),
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean, record) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('vi-VN') : '-'),
      sorter: (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa bot profile này?"
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
          Bot Profiles
        </Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
            Thêm bot
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefreshCache}>
            Refresh cache
          </Button>
          <Popconfirm
            title="Seed bots mặc định?"
            description="Sẽ thêm các bot mẫu nếu collection rỗng."
            onConfirm={handleSeedDefaults}
            okText="Seed"
            cancelText="Hủy"
          >
            <Button icon={<DatabaseOutlined />}>Seed defaults</Button>
          </Popconfirm>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={profiles}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingProfile ? 'Sửa Bot Profile' : 'Thêm Bot Profile'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        okText={editingProfile ? 'Cập nhật' : 'Tạo'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Tên bot"
            rules={[{ required: true, message: 'Vui lòng nhập tên bot' }]}
          >
            <Input placeholder="Bot A" />
          </Form.Item>

          <Form.Item
            name="avatar"
            label="URL Avatar"
            rules={[{ required: true, message: 'Vui lòng nhập URL avatar' }]}
          >
            <Input placeholder="https://example.com/avatar.png" />
          </Form.Item>

          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>

          {/* Preview */}
          <Form.Item label="Preview">
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.avatar !== cur.avatar || prev.name !== cur.name}>
              {({ getFieldValue }) => (
                <Space>
                  <Avatar src={getFieldValue('avatar') || undefined} size={48}>
                    {getFieldValue('name')?.trim().charAt(0).toUpperCase() || 'B'}
                  </Avatar>
                  <span>{getFieldValue('name') || 'Bot Name'}</span>
                </Space>
              )}
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BotProfilesPage;
