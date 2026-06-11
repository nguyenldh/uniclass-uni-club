import { useEffect, useState } from 'react';
import {
  Form,
  InputNumber,
  Input,
  Button,
  Card,
  message,
  Spin,
  Typography,
  Divider,
  Checkbox,
  Alert,
  Row,
  Col,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import { DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG } from '@uniclub/shared';
import type { WeeklyEventGeneralConfig } from '@uniclub/shared';

const { Title, Text } = Typography;

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function WeeklyEventGeneralSettingsPage() {
  const [form] = Form.useForm<WeeklyEventGeneralConfig>();
  const [saving, setSaving] = useState(false);
  const { generalConfig, isLoading, loadGeneralConfig, updateGeneralConfig } = useWeeklyEventStore();

  useEffect(() => {
    loadGeneralConfig();
  }, [loadGeneralConfig]);

  useEffect(() => {
    const cfg = generalConfig ?? DEFAULT_WEEKLY_EVENT_GENERAL_CONFIG;
    form.setFieldsValue(cfg);
  }, [generalConfig, form]);

  const handleSave = async (values: WeeklyEventGeneralConfig) => {
    setSaving(true);
    try {
      await updateGeneralConfig(values);
      message.success('Đã lưu cấu hình Sự kiện tuần');
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !generalConfig) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình chung — Sự kiện tuần</Title>

      <Alert
        type="warning"
        showIcon
        message="Lưu ý"
        description="Thay đổi cron expression không ảnh hưởng đến các sự kiện đã Scheduled. Chỉ áp dụng cho sự kiện được tạo mới."
        style={{ marginBottom: 16 }}
      />

      <Card style={{ maxWidth: 900 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Divider orientation="left">Thời gian</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="defaultWaitingDuration"
                label="Thời gian chờ (phút)"
                rules={[{ required: true }]}
                tooltip="Thời gian tập hợp học sinh trước khi phát đề"
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="defaultExamDuration"
                label="Thời gian làm bài (phút)"
                rules={[{ required: true }]}
              >
                <InputNumber min={5} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="defaultLeaderboardDuration"
                label="Thời gian hiển thị BXH (phút)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Hiển thị</Divider>

          <Form.Item
            name="leaderboardLimit"
            label="Số lượng hiển thị trong Top"
            rules={[{ required: true }]}
          >
            <InputNumber min={3} max={50} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="defaultActiveGrades"
            label="Khối lớp mặc định tham gia"
            rules={[{ required: true }]}
          >
            <Checkbox.Group options={GRADE_OPTIONS.map((g) => ({ label: `Khối ${g}`, value: g }))} />
          </Form.Item>

          <Divider orientation="left">Lịch trình</Divider>

          <Form.Item
            name="timezone"
            label="Múi giờ"
            rules={[{ required: true }]}
          >
            <Input placeholder="Asia/Ho_Chi_Minh" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Lưu cấu hình
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
