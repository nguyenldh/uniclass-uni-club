import { useEffect, useState } from 'react';
import { Form, InputNumber, Button, Card, message, Space, Spin, Typography, Popconfirm } from 'antd';
import { SaveOutlined, ClearOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../stores/config.store';
import { MatchmakingModeSection } from '../../components';
import type { GomokuConfig } from '@uniclub/shared';

const { Title } = Typography;

export function GomokuConfigPage() {
  const [form] = Form.useForm<GomokuConfig>();
  const [saving, setSaving] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  
  const { gomoku, isLoading, loadConfigs, updateGomoku, invalidateCache } = useConfigStore();

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (gomoku) {
      form.setFieldsValue(gomoku);
    }
  }, [gomoku, form]);

  const handleSave = async (values: GomokuConfig) => {
    setSaving(true);
    try {
      await updateGomoku(values);
      message.success('Đã lưu cấu hình Cờ Caro');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleInvalidateCache = async () => {
    setInvalidating(true);
    try {
      await invalidateCache('gomoku');
      message.success('Đã xóa cache Cờ Caro');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Xóa cache thất bại');
    } finally {
      setInvalidating(false);
    }
  };

  if (isLoading && !gomoku) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>Đang tải cấu hình...</div>
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình Cờ Caro</Title>
      
      <Card style={{ maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={gomoku || undefined}
        >
          <Form.Item
            name="matchmakingTimeout"
            label="Thời gian tìm trận tối đa (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Thời gian chờ ghép đối thủ trước khi chuyển sang đấu AI"
          >
            <InputNumber min={10} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <MatchmakingModeSection />

          <Form.Item
            name="winPoints"
            label="Cúp thưởng khi thắng"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số Cúp người chơi nhận được khi thắng trận"
          >
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="boardSize"
            label="Kích thước bàn cờ"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số ô mỗi chiều của bàn cờ (VD: 15 = 15x15)"
          >
            <InputNumber min={9} max={19} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Lưu cấu hình
              </Button>
              
              <Popconfirm
                title="Xóa cache Cờ Caro?"
                description="Cache sẽ được xây dựng lại khi có request mới."
                onConfirm={handleInvalidateCache}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button
                  icon={<ClearOutlined />}
                  loading={invalidating}
                >
                  Xóa cache
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default GomokuConfigPage;
