import { useState } from 'react';
import { Button, Card, Input, InputNumber, Space, Typography, message, Alert } from 'antd';
import { PlayCircleOutlined, StopOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { bossBattleService } from '../../services/boss-battle.service';
import type { InitWeekResult, CloseWeekResult } from '../../services/boss-battle.service';

const { Title, Paragraph, Text } = Typography;

function defaultWeekKey(): string {
  const d = new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export interface CyclePageProps {
  weekKey?: string;
  embedded?: boolean;
}

export function CyclePage({ weekKey: externalWeekKey, embedded }: CyclePageProps = {}) {
  const [localWeekKey, setLocalWeekKey] = useState(defaultWeekKey());
  const weekKey = externalWeekKey ?? localWeekKey;
  const setWeekKey = setLocalWeekKey;
  const [gradesText, setGradesText] = useState('3,4,5,6,7,8,9');
  const [topN, setTopN] = useState(10);
  const [initLoading, setInitLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [expireLoading, setExpireLoading] = useState(false);
  const [initResult, setInitResult] = useState<InitWeekResult | null>(null);
  const [closeResult, setCloseResult] = useState<CloseWeekResult | null>(null);

  const handleInit = async () => {
    setInitLoading(true);
    try {
      const grades = gradesText
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const res = await bossBattleService.initWeek(weekKey, grades.length > 0 ? grades : undefined);
      setInitResult(res);
      message.success(`Init xong: ${res.initializedGrades.length} khối mới`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Init thất bại');
    } finally {
      setInitLoading(false);
    }
  };

  const handleClose = async () => {
    setCloseLoading(true);
    try {
      const res = await bossBattleService.closeWeek(weekKey, topN);
      setCloseResult(res);
      message.success(`Đã đóng tuần ${weekKey}`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Đóng tuần thất bại');
    } finally {
      setCloseLoading(false);
    }
  };

  const handleExpire = async () => {
    setExpireLoading(true);
    try {
      const res = await bossBattleService.expireHonors();
      message.success(`Đã hết hạn ${res.updated} honor`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Expire thất bại');
    } finally {
      setExpireLoading(false);
    }
  };

  return (
    <div>
      {!embedded && <Title level={4}>Quản lý chu kỳ tuần</Title>}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Các thao tác idempotent — gọi nhiều lần an toàn nhờ Redis lock & unique index."
      />

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {!embedded && (
            <Space>
              <Text strong>weekKey:</Text>
              <Input value={weekKey} onChange={(e) => setWeekKey(e.target.value)} style={{ width: 200 }} />
            </Space>
          )}

          <Space>
            <Text strong>Grades (init):</Text>
            <Input
              value={gradesText}
              onChange={(e) => setGradesText(e.target.value)}
              style={{ width: 280 }}
              placeholder="vd 3,4,5,6,7,8,9"
            />
          </Space>

          <Space>
            <Text strong>TopN (close):</Text>
            <InputNumber value={topN} min={1} max={100} onChange={(v) => setTopN(Number(v ?? 10))} />
          </Space>
        </Space>
      </Card>

      <Space wrap>
        <Button type="primary" icon={<PlayCircleOutlined />} loading={initLoading} onClick={handleInit}>
          Init Week
        </Button>
        <Button danger icon={<StopOutlined />} loading={closeLoading} onClick={handleClose}>
          Close Week
        </Button>
        <Button icon={<ClockCircleOutlined />} loading={expireLoading} onClick={handleExpire}>
          Expire Honors
        </Button>
      </Space>

      {initResult && (
        <Card title="Kết quả Init" style={{ marginTop: 16 }}>
          <Paragraph>
            <Text strong>weekKey:</Text> {initResult.weekKey}
          </Paragraph>
          <Paragraph>
            <Text strong>Khối đã init:</Text>{' '}
            {initResult.initializedGrades.join(', ') || '(không có)'}
          </Paragraph>
          <Paragraph>
            <Text strong>Khối skip:</Text> {initResult.skippedGrades.join(', ') || '(không có)'}
          </Paragraph>
          <Paragraph>
            <Text strong>Đã đóng tuần trước:</Text>{' '}
            {initResult.closedPreviousWeek ? `Có (${initResult.previousWeekKey})` : 'Không'}
          </Paragraph>
        </Card>
      )}

      {closeResult && (
        <Card title="Kết quả Close" style={{ marginTop: 16 }}>
          <Paragraph>
            <Text strong>weekKey:</Text> {closeResult.weekKey}
          </Paragraph>
          {closeResult.honorsCreated.map((h) => (
            <Paragraph key={h.gradeLevel}>
              Khối {h.gradeLevel}: {h.count} honor
            </Paragraph>
          ))}
        </Card>
      )}
    </div>
  );
}

export default CyclePage;
