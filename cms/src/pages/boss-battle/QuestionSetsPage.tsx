import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Modal,
  List,
  Popconfirm,
  Alert,
} from 'antd';
import { ReloadOutlined, SwapOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { bossBattleService } from '../../services/boss-battle.service';
import type { BossQuestion, BossQuestionSet } from '@uniclub/shared';

const { Title, Text } = Typography;

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function defaultWeekKey(): string {
  const d = new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

const DAY_NAMES_VI = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

function getIsoWeekMonday(weekKey: string): Date | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO week: week 1 contains Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function formatDayLabel(weekKey: string, dayIndex: number): string {
  // dayIndex 1..7 → Mon..Sun
  const idx = Math.max(1, Math.min(7, dayIndex)) - 1;
  const name = DAY_NAMES_VI[idx];
  const monday = getIsoWeekMonday(weekKey);
  if (!monday) return name;
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + idx);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${name}, ${dd}/${mm}/${yyyy}`;
}

export interface QuestionSetsPageProps {
  weekKey?: string;
  grade?: number;
  lockGrade?: boolean;
  embedded?: boolean;
}

export function QuestionSetsPage({
  weekKey: externalWeekKey,
  grade: externalGrade,
  lockGrade,
  embedded,
}: QuestionSetsPageProps = {}) {
  const [localWeekKey, setLocalWeekKey] = useState<string>(defaultWeekKey());
  const weekKey = externalWeekKey ?? localWeekKey;
  const setWeekKey = setLocalWeekKey;
  const [localGrade, setLocalGrade] = useState<number>(externalGrade ?? 6);
  const grade = externalGrade ?? localGrade;
  const setGrade = setLocalGrade;
  const [sets, setSets] = useState<BossQuestionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questionMap, setQuestionMap] = useState<Record<string, BossQuestion>>({});

  const [swapModalOpen, setSwapModalOpen] = useState(false);
  // oldQId = null → chế độ THÊM câu; có giá trị → chế độ THAY THẾ câu đó
  const [swapContext, setSwapContext] = useState<{ setId: string; oldQId: string | null } | null>(null);
  const [candidates, setCandidates] = useState<BossQuestion[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  // Số câu tối đa mỗi ngày (questionsPerDay) của tuần × khối — để giới hạn nút "Thêm câu hỏi"
  const [maxPerDay, setMaxPerDay] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bossBattleService.listSets(weekKey, grade);
      setSets(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tải bộ câu hỏi thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load khi (weekKey, grade) thay đổi — tránh phải bấm "Tải lại"
  useEffect(() => {
    if (!weekKey || !grade) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await bossBattleService.listSets(weekKey, grade);
        if (!cancelled) setSets(data);
      } catch (err: any) {
        if (!cancelled) {
          message.error(err.response?.data?.error || 'Tải bộ câu hỏi thất bại');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekKey, grade]);

  // Lấy giới hạn số câu/ngày (questionsPerDay) theo cấu hình hiệu lực của tuần × khối
  useEffect(() => {
    if (!weekKey || !grade) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await bossBattleService.getWeeklyConfig(weekKey, grade);
        if (!cancelled) setMaxPerDay(cfg?.effectiveConfig?.questionsPerDay ?? null);
      } catch {
        if (!cancelled) setMaxPerDay(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekKey, grade]);

  // Fetch question contents for all IDs across sets (batch)
  useEffect(() => {
    const allIds = Array.from(new Set(sets.flatMap((s) => s.questionIds)));
    const missing = allIds.filter((id) => !questionMap[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await bossBattleService.getQuestionsByIds(missing);
        if (cancelled) return;
        setQuestionMap((prev) => {
          const next = { ...prev };
          for (const q of items) next[q.id] = q;
          return next;
        });
      } catch {
        // silent — row will show "đang tải…"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sets, questionMap]);

  const handleAutoGenerate = async (force: boolean) => {
    setGenerating(true);
    try {
      const res = await bossBattleService.autoGenerate(weekKey, grade, force);
      message.success(`Đã tạo ${res.created} bộ, bỏ qua ${res.skipped}`);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tạo bộ câu thất bại');
    } finally {
      setGenerating(false);
    }
  };

  const openSwap = async (setId: string, oldQId: string) => {
    setSwapContext({ setId, oldQId });
    setSwapModalOpen(true);
    setCandidateSearch('');
    await searchCandidates('');
  };

  const openAdd = async (setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (maxPerDay != null && set && set.questionIds.length >= maxPerDay) {
      message.warning(`Bộ này đã đủ ${maxPerDay} câu cho 1 ngày — không thể thêm.`);
      return;
    }
    setSwapContext({ setId, oldQId: null });
    setSwapModalOpen(true);
    setCandidateSearch('');
    await searchCandidates('');
  };

  const searchCandidates = async (search: string) => {
    setCandidatesLoading(true);
    try {
      // Danh sách Thay thế: chỉ câu CÙNG KHỐI và CHƯA ĐƯỢC GÁN set nào (backend lọc cả 2 điều kiện).
      const items = await bossBattleService.getUnassignedQuestions(grade, search || undefined);
      setCandidates(items);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handlePick = async (newQId: string) => {
    if (!swapContext) return;
    try {
      if (swapContext.oldQId) {
        await bossBattleService.swapQuestion(swapContext.setId, swapContext.oldQId, newQId);
        message.success('Đã thay câu hỏi');
      } else {
        await bossBattleService.addQuestionToSet(swapContext.setId, newQId);
        message.success('Đã thêm câu hỏi');
      }
      setSwapModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Thao tác thất bại');
    }
  };

  const handleRemove = async (setId: string, qid: string) => {
    try {
      await bossBattleService.removeQuestionFromSet(setId, qid);
      message.success('Đã xóa câu khỏi bộ (câu trở thành "chưa được gán")');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Xóa thất bại');
    }
  };

  return (
    <div>
      {!embedded && <Title level={4}>Bộ câu hỏi theo tuần</Title>}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          {!embedded && (
            <Input
              placeholder="weekKey (vd 2026-W23)"
              value={weekKey}
              onChange={(e) => setWeekKey(e.target.value)}
              style={{ width: 180 }}
            />
          )}
          <Select
            value={grade}
            onChange={setGrade}
            style={{ width: 120 }}
            disabled={lockGrade}
            options={GRADES.map((g) => ({ label: `Khối ${g}`, value: g }))}
          />
          <Button onClick={load} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={generating}
            onClick={() => handleAutoGenerate(false)}
          >
            Tạo câu hỏi tự động
          </Button>
          <Button
            danger
            icon={<ReloadOutlined />}
            loading={generating}
            onClick={() =>
              Modal.confirm({
                title: 'Tạo lại từ đầu?',
                content: 'Sẽ ghi đè câu hỏi của cả 7 ngày trong tuần này. Tiếp tục?',
                onOk: () => handleAutoGenerate(true),
              })
            }
          >
            Tạo lại từ đầu (ghi đè)
          </Button>
        </Space>
      </Card>

      <Card>
        <Table<BossQuestionSet>
          rowKey="id"
          loading={loading}
          dataSource={sets}
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <>
              <List
                size="small"
                dataSource={record.questionIds}
                renderItem={(qid, idx) => {
                  const q = questionMap[qid];
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="swap"
                          size="small"
                          icon={<SwapOutlined />}
                          onClick={() => openSwap(record.id, qid)}
                        >
                          Thay thế
                        </Button>,
                        <Popconfirm
                          key="del"
                          title="Xóa câu khỏi bộ này?"
                          description='Câu sẽ trở thành "chưa được gán" và có thể chọn lại khi Thay thế.'
                          onConfirm={() => handleRemove(record.id, qid)}
                          okText="Xóa"
                          cancelText="Hủy"
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            Xóa
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong>Câu {idx + 1}:</Text>{' '}
                        {q ? (
                          <Text>{q.content}</Text>
                        ) : (
                          <Text type="secondary" italic>
                            đang tải…
                          </Text>
                        )}
                        <div style={{ marginTop: 2 }}>
                          <Tag style={{ fontSize: 11 }}>{qid}</Tag>
                          {q && (
                            <Tag color="blue" style={{ fontSize: 11 }}>
                              Khối {q.grade}
                            </Tag>
                          )}
                          {q && !q.isActive && (
                            <Tag color="red" style={{ fontSize: 11 }}>
                              Inactive
                            </Tag>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                style={{ marginTop: 8 }}
                disabled={maxPerDay != null && record.questionIds.length >= maxPerDay}
                onClick={() => openAdd(record.id)}
              >
                Thêm câu hỏi
              </Button>
              {maxPerDay != null && record.questionIds.length >= maxPerDay && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  Đã đủ {maxPerDay} câu cho ngày này
                </Text>
              )}
              </>
            ),
          }}
          columns={[
            {
              title: 'Ngày',
              dataIndex: 'dayIndex',
              width: 200,
              render: (dayIndex: number) => formatDayLabel(weekKey, dayIndex),
            },
            { title: 'Số câu', render: (_, r) => r.questionIds.length, width: 100 },
            { title: 'Mã bộ', dataIndex: 'id', ellipsis: true },
          ]}
        />
      </Card>

      <Modal
        open={swapModalOpen}
        title={swapContext?.oldQId ? 'Chọn câu thay thế' : 'Chọn câu để thêm'}
        onCancel={() => setSwapModalOpen(false)}
        footer={null}
        width={700}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Chỉ hiển thị câu Khối ${grade} và chưa được gán vào bất kỳ bộ nào.`}
        />
        <Input.Search
          placeholder="Tìm câu hỏi"
          allowClear
          onSearch={searchCandidates}
          style={{ marginBottom: 12 }}
        />
        <List
          loading={candidatesLoading}
          dataSource={candidates}
          renderItem={(q) => (
            <List.Item
              actions={[
                <Button key="pick" type="primary" size="small" onClick={() => handlePick(q.id)}>
                  Chọn
                </Button>,
              ]}
            >
              <Text ellipsis>{q.content}</Text>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}

export default QuestionSetsPage;
