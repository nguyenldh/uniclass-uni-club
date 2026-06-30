import { useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Select,
  Spin,
  Alert,
  Typography,
  Tooltip,
  Divider,
  Tag,
} from 'antd';
import {
  TeamOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  PercentageOutlined,
  ThunderboltOutlined,
  FireOutlined,
  CalendarOutlined,
  RiseOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useAnalyticsStore } from '../stores/analytics.store';

const { Title, Text } = Typography;

const periodOptions = [
  { label: '7 ngày qua', value: '7d' },
  { label: '30 ngày qua', value: '30d' },
  { label: 'Tất cả', value: 'all' },
];

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function KpiCard({
  title,
  value,
  suffix,
  icon,
  color,
  tooltip,
  precision,
}: {
  title: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
  precision?: number;
}) {
  return (
    <Card
      hoverable
      style={{ height: '100%', borderTop: `3px solid ${color}` }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Statistic
          title={
            <span>
              {title}{' '}
              <Tooltip title={tooltip}>
                <InfoCircleOutlined style={{ color: '#999', fontSize: 12 }} />
              </Tooltip>
            </span>
          }
          value={value}
          suffix={suffix}
          precision={precision ?? 1}
          valueStyle={{ color, fontWeight: 600 }}
        />
        <div
          style={{
            fontSize: 28,
            color,
            opacity: 0.8,
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { overview, loading, error, period, setPeriod, fetchOverview } = useAnalyticsStore();

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            📊 Analytics Dashboard
          </Title>
          <Text type="secondary">Tổng quan chỉ số hoạt động UniClub</Text>
        </div>
        <Select
          value={period}
          onChange={(v) => setPeriod(v as '7d' | '30d' | 'all')}
          options={periodOptions}
          style={{ width: 160 }}
          size="large"
        />
      </div>

      {error && (
        <Alert
          type="error"
          message="Lỗi tải dữ liệu"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading} size="large">
        {overview ? (
          <>
            {/* ---- Section 1: Participation & Retention ---- */}
            <Divider orientation="left">
              <TeamOutlined /> Tham gia & Giữ chân
            </Divider>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <KpiCard
                  title="Tổng HS truy cập UniClub"
                  value={overview.totalUniclubUsers}
                  icon={<TeamOutlined />}
                  color="#1890ff"
                  tooltip="Tổng số học sinh đã truy cập vào hệ thống UniClub"
                  precision={0}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <KpiCard
                  title="HS đã chơi game"
                  value={overview.totalGamePlayers}
                  icon={<PlayCircleOutlined />}
                  color="#52c41a"
                  tooltip="Số học sinh đã tham gia ít nhất 1 trận game (regular)"
                  precision={0}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <KpiCard
                  title="Tỷ lệ tham gia game"
                  value={overview.participationRateGame}
                  suffix="%"
                  icon={<PercentageOutlined />}
                  color="#722ed1"
                  tooltip="HS chơi game / Tổng HS truy cập UniClub"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <KpiCard
                  title="Retention tuần"
                  value={overview.retentionRateWeekly}
                  suffix="%"
                  icon={<RiseOutlined />}
                  color="#fa8c16"
                  tooltip="(HS cuối tuần - HS mới) / HS đầu tuần"
                />
              </Col>
            </Row>

            {/* ---- Section 2: Completion rates ---- */}
            <Divider orientation="left" style={{ marginTop: 32 }}>
              <TrophyOutlined /> Tỷ lệ hoàn thành
            </Divider>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card hoverable style={{ height: '100%', borderTop: '3px solid #13c2c2' }}>
                  <Statistic
                    title={
                      <span>
                        So Tài{' '}
                        <Tag color="cyan" style={{ fontSize: 10 }}>
                          Quiz Arena
                        </Tag>
                      </span>
                    }
                    value={overview.completionRateQuizArena}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: '#13c2c2', fontWeight: 600 }}
                    prefix={<ThunderboltOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trận hoàn thành / Tổng trận được mở
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card hoverable style={{ height: '100%', borderTop: '3px solid #2f54eb' }}>
                  <Statistic
                    title={
                      <span>
                        Đấu Trí{' '}
                        <Tag color="blue" style={{ fontSize: 10 }}>
                          Mind Game
                        </Tag>
                      </span>
                    }
                    value={overview.completionRateMindGame}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: '#2f54eb', fontWeight: 600 }}
                    prefix={<ThunderboltOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trận hoàn thành / Tổng trận được mở
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card hoverable style={{ height: '100%', borderTop: '3px solid #f5222d' }}>
                  <Statistic
                    title={
                      <span>
                        Săn Boss{' '}
                        <Tag color="red" style={{ fontSize: 10 }}>
                          Boss Battle
                        </Tag>
                      </span>
                    }
                    value={overview.completionRateBossBattle}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: '#f5222d', fontWeight: 600 }}
                    prefix={<FireOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Lượt chơi hoàn thành / Tổng lượt chơi
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card hoverable style={{ height: '100%', borderTop: '3px solid #eb2f96' }}>
                  <Statistic
                    title={
                      <span>
                        Weekly Event{' '}
                        <Tag color="magenta" style={{ fontSize: 10 }}>
                          Sự kiện tuần
                        </Tag>
                      </span>
                    }
                    value={overview.completionRateWeeklyEvent}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: '#eb2f96', fontWeight: 600 }}
                    prefix={<CalendarOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    HS nộp bài / Tổng HS tham gia
                  </Text>
                </Card>
              </Col>
            </Row>

            {/* ---- Section 3: Average scores & times ---- */}
            <Divider orientation="left" style={{ marginTop: 32 }}>
              <ThunderboltOutlined /> Điểm & Thời gian trung bình
            </Divider>
            <Row gutter={[16, 16]}>
              {/* So Tài */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <ThunderboltOutlined style={{ color: '#13c2c2' }} /> So Tài
                    </span>
                  }
                  hoverable
                >
                  <Row gutter={24}>
                    <Col span={12}>
                      <Statistic
                        title="Điểm trung bình"
                        value={overview.avgScoreQuizArena}
                        precision={1}
                        valueStyle={{ color: '#13c2c2' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="TG trung bình"
                        value={formatTime(overview.avgTimeQuizArena)}
                        valueStyle={{ color: '#13c2c2' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Đấu Trí */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <ThunderboltOutlined style={{ color: '#2f54eb' }} /> Đấu Trí
                    </span>
                  }
                  hoverable
                >
                  <Row gutter={24}>
                    <Col span={12}>
                      <Statistic
                        title="Điểm trung bình"
                        value={overview.avgScoreMindGame}
                        precision={1}
                        valueStyle={{ color: '#2f54eb' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="TG trung bình"
                        value={formatTime(overview.avgTimeMindGame)}
                        valueStyle={{ color: '#2f54eb' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Săn Boss */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <FireOutlined style={{ color: '#f5222d' }} /> Săn Boss
                    </span>
                  }
                  hoverable
                >
                  <Row gutter={24}>
                    <Col span={12}>
                      <Statistic
                        title="Điểm trung bình"
                        value={overview.avgScoreBossBattle}
                        precision={1}
                        valueStyle={{ color: '#f5222d' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="TG trung bình"
                        value={formatTime(overview.avgTimeBossBattle)}
                        valueStyle={{ color: '#f5222d' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Weekly Event */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <CalendarOutlined style={{ color: '#eb2f96' }} /> Weekly Event
                    </span>
                  }
                  hoverable
                >
                  <Row gutter={24}>
                    <Col span={12}>
                      <Statistic
                        title="Điểm trung bình"
                        value={overview.avgScoreWeeklyEvent}
                        precision={1}
                        valueStyle={{ color: '#eb2f96' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="TG trung bình"
                        value={formatTime(overview.avgTimeWeeklyEvent)}
                        valueStyle={{ color: '#eb2f96' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            {/* Footer info */}
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khoảng thời gian:{' '}
                {overview.period.label === 'all'
                  ? 'Tất cả'
                  : `${new Date(overview.period.from).toLocaleDateString('vi-VN')} — ${new Date(overview.period.to).toLocaleDateString('vi-VN')}`}
              </Text>
            </div>
          </>
        ) : (
          !loading &&
          !error && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Text type="secondary">Chưa có dữ liệu analytics.</Text>
            </div>
          )
        )}
      </Spin>
    </div>
  );
}

export default DashboardPage;
