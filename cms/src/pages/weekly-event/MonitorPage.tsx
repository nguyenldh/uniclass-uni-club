import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Spin,
  Button,
  Space,
  message,
} from 'antd';
import {
  TeamOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { useWeeklyEventStore } from '../../stores/weekly-event.store';
import {
  WEEKLY_EVENT_NAMESPACES,
  WEEKLY_EVENT_ADMIN_SOCKET_EVENTS,
} from '@uniclub/shared';
import type { MonitorMetrics, WeeklyEvent } from '@uniclub/shared';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  Waiting: 'cyan',
  InProgress: 'green',
  Grading: 'orange',
  Showing: 'purple',
  Closed: 'default',
  Cancelled: 'red',
};

export function WeeklyEventMonitorPage() {
  const { events, loadEvents, cancelEvent } = useWeeklyEventStore();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MonitorMetrics[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Load active events
  useEffect(() => {
    loadEvents({ status: undefined, page: 1, pageSize: 50 });
  }, [loadEvents]);

  const liveEvents = events.filter((e) =>
    ['Waiting', 'InProgress', 'Grading', 'Showing'].includes(e.status),
  );

  // Connect socket when event selected
  useEffect(() => {
    if (!selectedEventId) return;

    const token = localStorage.getItem('admin_token');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    const s = io(`${socketUrl}${WEEKLY_EVENT_NAMESPACES.ADMIN}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setConnected(true);
      s.emit(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_SUBSCRIBE, {
        eventId: selectedEventId,
      });
    });

    s.on('disconnect', () => setConnected(false));

    s.on(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_METRICS, (data: MonitorMetrics[]) => {
      setMetrics(data);
    });

    s.on(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_ALERT, (alert: any) => {
      message.warning(`[${alert.level}] ${alert.message}`);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [selectedEventId]);

  const handleCancelEvent = async () => {
    if (!selectedEventId) return;
    try {
      await cancelEvent(selectedEventId, 'Admin huỷ từ màn hình giám sát');
      message.success('Đã huỷ sự kiện');
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Huỷ thất bại');
    }
  };

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  return (
    <div>
      <Title level={4}>Theo dõi Sự kiện tuần</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            showSearch
            placeholder="Chọn sự kiện đang diễn ra"
            style={{ width: 400 }}
            value={selectedEventId}
            onChange={setSelectedEventId}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={liveEvents.map((e) => ({
              value: e._id,
              label: `${e.title} (Tuần ${e.weekNumber}/${e.year}) — ${e.status}`,
            }))}
          />
          <Tag color={connected ? 'green' : 'red'}>
            {connected ? 'Đã kết nối' : 'Mất kết nối'}
          </Tag>
          {selectedEvent && (
            <Button danger icon={<StopOutlined />} onClick={handleCancelEvent}>
              Huỷ sự kiện khẩn cấp
            </Button>
          )}
        </Space>
      </Card>

      {!selectedEventId ? (
        <Card>
          <Text type="secondary">Chọn một sự kiện đang diễn ra để theo dõi.</Text>
        </Card>
      ) : metrics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
          <p>Đang chờ dữ liệu...</p>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {metrics.map((m) => (
            <Col span={8} key={m.grade}>
              <Card
                title={`Khối ${m.grade}`}
                extra={
                  <Tag color={STATUS_COLOR[selectedEvent?.status || 'Waiting']}>
                    {selectedEvent?.status}
                  </Tag>
                }
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Online"
                      value={m.online}
                      prefix={<TeamOutlined />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Đã nộp"
                      value={m.submitted}
                      prefix={<FileDoneOutlined />}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
