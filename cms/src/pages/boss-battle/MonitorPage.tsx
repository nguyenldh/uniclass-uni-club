import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { bossBattleService } from '../../services/boss-battle.service';
import type {
  BossInstanceMonitorEntry,
  BossLeaderboardEntry,
  WeeklyHonor,
} from '@uniclub/shared';

const { Title, Text } = Typography;

const GRADES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Trả về ISO weekKey (YYYY-Www) UTC cho ngày bất kỳ */
function toIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getCurrentWeekKey(): string {
  return toIsoWeekKey(new Date());
}

/** Sinh danh sách weekKey ±`range` tuần quanh tuần hiện tại, mới nhất lên trên */
function buildWeekOptions(range = 26): { label: string; value: string }[] {
  const today = new Date();
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  const out: { label: string; value: string }[] = [];
  for (let offset = range; offset >= -range; offset--) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + offset * 7);
    const key = toIsoWeekKey(d);
    const sunday = new Date(d);
    sunday.setUTCDate(d.getUTCDate() + 6);
    const fmt = (x: Date) =>
      `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ value: key, label: `${key}  (${fmt(d)} — ${fmt(sunday)})` });
  }
  return out;
}

export function MonitorPage() {
  const weekOptions = useMemo(() => buildWeekOptions(26), []);
  const [initializedWeeks, setInitializedWeeks] = useState<string[]>([]);
  const [weekKey, setWeekKey] = useState<string>(getCurrentWeekKey());
  const [grade, setGrade] = useState<number>(6);

  const [instances, setInstances] = useState<BossInstanceMonitorEntry[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);

  const [lbEntries, setLbEntries] = useState<BossLeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  const [honors, setHonors] = useState<WeeklyHonor[]>([]);
  const [honorsLoading, setHonorsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('instances');

  // ---- Auto-load initialized weeks on mount ----
  const refreshInitializedWeeks = useCallback(async () => {
    try {
      const weeks = await bossBattleService.listInitializedWeeks();
      setInitializedWeeks(weeks);
      setWeekKey((cur) => {
        if (weeks.includes(cur)) return cur;
        if (weeks.length === 0) return cur;
        return weeks[weeks.length - 1];
      });
    } catch {
      setInitializedWeeks([]);
    }
  }, []);

  useEffect(() => {
    refreshInitializedWeeks();
  }, [refreshInitializedWeeks]);

  // ---- Load instances when weekKey changes ----
  const loadInstances = useCallback(async () => {
    setInstancesLoading(true);
    try {
      const data = await bossBattleService.listInstances(weekKey || undefined);
      setInstances(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tải instance thất bại');
    } finally {
      setInstancesLoading(false);
    }
  }, [weekKey]);

  // ---- Load leaderboard when weekKey or grade changes ----
  const loadLeaderboard = useCallback(async () => {
    if (!weekKey || !grade) return;
    setLbLoading(true);
    try {
      const data = await bossBattleService.getLeaderboard(weekKey, grade);
      setLbEntries(data.entries);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tải BXH thất bại');
    } finally {
      setLbLoading(false);
    }
  }, [weekKey, grade]);

  // ---- Load honors when weekKey or grade changes ----
  const loadHonors = useCallback(async () => {
    if (!weekKey) return;
    setHonorsLoading(true);
    try {
      const data = await bossBattleService.getHonors(weekKey, grade);
      setHonors(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tải honor thất bại');
    } finally {
      setHonorsLoading(false);
    }
  }, [weekKey, grade]);

  // ---- Auto-load on mount & when weekKey/grade changes ----
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    if (activeTab === 'leaderboard') loadLeaderboard();
  }, [activeTab, loadLeaderboard]);

  useEffect(() => {
    if (activeTab === 'honors') loadHonors();
  }, [activeTab, loadHonors]);

  // ---- Tab change: auto-load data for the new tab ----
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'leaderboard') loadLeaderboard();
    if (key === 'honors') loadHonors();
  };

  return (
    <div>
      <Title level={4}>Theo dõi Săn Quái Vật</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Tuần:</Text>
          <Select
            showSearch
            value={weekKey}
            onChange={(v) => setWeekKey(v)}
            options={weekOptions.map((w) => ({
              ...w,
              disabled: !initializedWeeks.includes(w.value),
              label: initializedWeeks.includes(w.value)
                ? w.label
                : `${w.label}  — chưa khởi tạo`,
            }))}
            style={{ width: 320 }}
            placeholder="Chọn tuần"
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
          <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={instancesLoading}>
            Tải lại
          </Button>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'instances',
            label: 'Trạng thái Quái Vật',
            children: (
              <Card>
                <Table<BossInstanceMonitorEntry>
                  rowKey={(r) => r.instance.id}
                  loading={instancesLoading}
                  dataSource={instances}
                  pagination={false}
                  columns={[
                    { title: 'Tuần', dataIndex: ['instance', 'weekKey'], width: 130 },
                    { title: 'Khối', dataIndex: ['instance', 'gradeLevel'], width: 80 },
                    {
                      title: 'Trạng thái',
                      dataIndex: ['instance', 'status'],
                      width: 120,
                      render: (s: string) => {
                        const color = s === 'ACTIVE' ? 'blue' : s === 'DEFEATED' ? 'red' : s === 'CLOSED' ? 'default' : 'default';
                        return <Tag color={color}>{s}</Tag>;
                      },
                    },
                    {
                      title: 'Progress',
                      dataIndex: ['instance', 'progressPercent'],
                      render: (v: number) => <Progress percent={Math.round(v)} size="small" />,
                    },
                    {
                      title: 'Điểm/HP',
                      render: (_, r) =>
                        `${r.instance.totalPointsEarned} / ${r.instance.config.hpMax}`,
                      width: 160,
                    },
                    { title: 'Học sinh', dataIndex: 'participantCount', width: 100 },
                    { title: 'Lượt xong', dataIndex: 'completedAttemptCount', width: 100 },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'leaderboard',
            label: 'Bảng xếp hạng',
            children: (
              <Card
                extra={
                  <Space>
                    <Select
                      value={grade}
                      onChange={setGrade}
                      style={{ width: 120 }}
                      options={GRADES.map((g) => ({ label: `Khối ${g}`, value: g }))}
                    />
                    <Button icon={<ReloadOutlined />} onClick={loadLeaderboard} loading={lbLoading}>
                      Tải
                    </Button>
                  </Space>
                }
              >
                <Table<BossLeaderboardEntry>
                  rowKey={(r) => `${r.rank}-${r.studentId}`}
                  loading={lbLoading}
                  dataSource={lbEntries}
                  pagination={false}
                  columns={[
                    { title: '#', dataIndex: 'rank', width: 60 },
                    { title: 'Học sinh', dataIndex: 'displayName' },
                    { title: 'studentId', dataIndex: 'studentId', ellipsis: true },
                    { title: 'Câu đúng', dataIndex: 'correctCountWeek', width: 100 },
                    {
                      title: 'Tổng TG đúng (s)',
                      dataIndex: 'totalCorrectTimeSec',
                      width: 150,
                      render: (v: number) => v.toFixed(1),
                    },
                    { title: 'Điểm góp', dataIndex: 'pointsContributedWeek', width: 120 },
                  ]}
                />
              </Card>
            ),
          },
          // {
          //   key: 'honors',
          //   label: 'Weekly Honors',
          //   children: (
          //     <Card
          //       extra={
          //         <Space>
          //           <Select
          //             value={grade}
          //             onChange={setGrade}
          //             style={{ width: 120 }}
          //             options={GRADES.map((g) => ({ label: `Khối ${g}`, value: g }))}
          //           />
          //           <Button icon={<ReloadOutlined />} onClick={loadHonors} loading={honorsLoading}>
          //             Tải
          //           </Button>
          //         </Space>
          //       }
          //     >
          //       <Table<WeeklyHonor>
          //         rowKey="id"
          //         loading={honorsLoading}
          //         dataSource={honors}
          //         pagination={false}
          //         columns={[
          //           { title: 'Khối', dataIndex: 'gradeLevel', width: 80 },
          //           { title: '#', dataIndex: 'rank', width: 60 },
          //           { title: 'Học sinh', dataIndex: 'displayName' },
          //           { title: 'studentId', dataIndex: 'studentId', ellipsis: true },
          //           { title: 'Câu đúng', dataIndex: 'correctCountWeek', width: 100 },
          //           {
          //             title: 'Hạn khung',
          //             dataIndex: 'frameExpiry',
          //             width: 200,
          //             render: (v: any) => new Date(v).toLocaleString('vi-VN'),
          //           },
          //           {
          //             title: 'Banner',
          //             dataIndex: 'bannerActive',
          //             width: 90,
          //             render: (v: boolean) =>
          //               v ? <Tag color="green">Hiện</Tag> : <Tag>Ẩn</Tag>,
          //           },
          //         ]}
          //       />
          //     </Card>
          //   ),
          // },
        ]}
      />
    </div>
  );
}

export default MonitorPage;
