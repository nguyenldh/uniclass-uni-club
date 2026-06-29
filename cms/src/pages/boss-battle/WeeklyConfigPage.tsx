import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  EditOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  BOSS_BATTLE_GRADES,
  OVERRIDABLE_BOSS_BATTLE_FIELDS,
} from '@uniclub/shared';
import type {
  BossBattleConfigOverride,
  BossStateImage,
  BossWeeklyConfig,
  OverridableBossBattleConfigKey,
} from '@uniclub/shared';
import { bossBattleService } from '../../services/boss-battle.service';
import { QuestionSetsPage } from './QuestionSetsPage';

const { Title, Text } = Typography;

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

/** Tuần đã đến mốc bắt đầu chạy chưa (now >= Monday 00:00 UTC của weekKey). */
function isWeekStartedClient(weekKey: string): boolean {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);
  if (!m) return false;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return Date.now() >= monday.getTime();
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

const FIELD_LABELS: Record<OverridableBossBattleConfigKey, string> = {
  hpMax: 'HP tối đa',
  questionsPerDay: 'Câu/ngày',
  questionsPerWeek: 'Câu/tuần',
  basePoint: 'Điểm cơ bản',
  maxSpeedBonus: 'Điểm tốc độ',
  tMaxSec: 'Thời gian/câu (s)',
  bossName: 'Tên Boss',
  bossStates: 'Trạng thái Boss',
};

export function WeeklyConfigPage() {
  const [weekKey, setWeekKey] = useState<string>(getCurrentWeekKey());
  const weekOptions = useMemo(() => buildWeekOptions(26), []);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BossWeeklyConfig[]>([]);

  const [editingGrade, setEditingGrade] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [setsModalGrade, setSetsModalGrade] = useState<number | null>(null);

  const [addGradesOpen, setAddGradesOpen] = useState(false);
  const [addGradesSelected, setAddGradesSelected] = useState<number[]>([]);
  const [addingGrades, setAddingGrades] = useState(false);

  const [initOpen, setInitOpen] = useState(false);
  const [initGrades, setInitGrades] = useState<number[]>([]);
  const [initWeekKey, setInitWeekKey] = useState<string>('');
  const [initializedWeeks, setInitializedWeeks] = useState<string[]>([]);
  const [initLoading, setInitLoading] = useState(false);
  // Số câu hỏi active theo khối + ngưỡng câu/tuần — để cảnh báo khi thiếu lúc khởi tạo
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({});
  const [requiredPerWeek, setRequiredPerWeek] = useState<number>(35);


  const load = useCallback(async () => {
    if (!weekKey.trim()) return;
    setLoading(true);
    try {
      // Không truyền `grades` → backend trả về đúng các khối đang mở cho tuần này.
      const data = await bossBattleService.listWeeklyConfigs(weekKey.trim());
      setItems(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Tải cấu hình tuần thất bại');
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  const refreshInitializedWeeks = useCallback(async () => {
    try {
      const weeks = await bossBattleService.listInitializedWeeks();
      setInitializedWeeks(weeks);
      // Nếu tuần hiện tại chưa init, tự chuyển sang tuần init mới nhất (nếu có)
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

  useEffect(() => {
    load();
  }, [load]);

  const editingItem = useMemo(
    () => (editingGrade != null ? items.find((i) => i.gradeLevel === editingGrade) ?? null : null),
    [editingGrade, items],
  );

  const handleResetOverride = async (grade: number) => {
    try {
      await bossBattleService.deleteWeeklyConfig(weekKey, grade);
      message.success(`Đã reset override khối ${grade}`);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Reset thất bại');
    }
  };

  const openInit = async () => {
    const active = items.map((i) => i.gradeLevel);
    setInitGrades(active);
    setInitWeekKey(weekKey);
    setInitOpen(true);
    refreshInitializedWeeks();
    // Tải số câu hỏi theo khối + ngưỡng câu/tuần để cảnh báo khi thiếu
    try {
      const [counts, config] = await Promise.all([
        bossBattleService.getQuestionCountByGrade(),
        bossBattleService.getConfig(),
      ]);
      setQuestionCounts(counts);
      setRequiredPerWeek(config.questionsPerWeek ?? 35);
    } catch {
      // Bỏ qua — backend vẫn chặn init khi thiếu câu hỏi
    }
  };

  const handleInit = async () => {
    if (initGrades.length === 0) {
      message.warning('Chọn ít nhất 1 khối');
      return;
    }
    if (!initWeekKey) {
      message.warning('Chọn tuần');
      return;
    }
    const short = initGrades.filter((g) => (questionCounts[g] ?? 0) < requiredPerWeek);
    if (short.length > 0) {
      message.error(
        `Không đủ ${requiredPerWeek} câu hỏi cho ${short.map((g) => `Khối ${g}`).join(', ')}. Vui lòng bổ sung câu hỏi trước khi khởi tạo.`,
      );
      return;
    }
    setInitLoading(true);
    try {
      const res = await bossBattleService.initWeek(initWeekKey, initGrades);
      message.success(
        `Init tuần ${res.weekKey}: ${res.initializedGrades.length} khối mới, ${res.skippedGrades.length} skip`,
      );
      setInitOpen(false);
      await refreshInitializedWeeks();
      // Chuyển picker tuần chính sang tuần vừa init để user thấy kết quả
      if (initWeekKey !== weekKey) setWeekKey(initWeekKey);
      else load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Init thất bại');
    } finally {
      setInitLoading(false);
    }
  };

  const openAddGrades = () => {
    setAddGradesSelected([]);
    setAddGradesOpen(true);
  };

  const handleAddGrades = async () => {
    if (addGradesSelected.length === 0) {
      setAddGradesOpen(false);
      return;
    }
    setAddingGrades(true);
    try {
      // Tạo override rỗng cho từng khối → row xuất hiện trong bảng, dùng template mặc định
      await Promise.all(
        addGradesSelected.map((g) => bossBattleService.upsertWeeklyConfig(weekKey, g, {})),
      );
      message.success(`Đã thêm ${addGradesSelected.length} khối vào tuần ${weekKey}`);
      setAddGradesOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Thêm khối thất bại');
    } finally {
      setAddingGrades(false);
    }
  };

  const columns: ColumnsType<BossWeeklyConfig> = [
    {
      title: 'Khối',
      dataIndex: 'gradeLevel',
      width: 80,
      render: (g: number) => <Tag>Khối {g}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'hasInstance',
      width: 130,
      render: (v: boolean) =>
        v ? (
          <Tag color="processing">Đã khởi tạo</Tag>
        ) : (
          <Tag color="default">Chưa khởi tạo</Tag>
        ),
    },
    {
      title: 'HP',
      width: 100,
      render: (_, r) => r.effectiveConfig?.hpMax != null ? r.effectiveConfig.hpMax.toLocaleString() : '—',
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Câu/ngày</span>,
      width: 90,
      render: (_, r) => r.effectiveConfig?.questionsPerDay ?? '—',
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Câu/tuần</span>,
      width: 90,
      render: (_, r) => r.effectiveConfig?.questionsPerWeek ?? '—',
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>tMax (s)</span>,
      width: 90,
      render: (_, r) => r.effectiveConfig?.tMaxSec ?? '—',
    },
    {
      title: 'Tên Boss',
      width: 160,
      ellipsis: true,
      render: (_, r) => (
        <Tooltip title={r.effectiveConfig?.bossName}>{r.effectiveConfig?.bossName ?? '—'}</Tooltip>
      ),
    },
    {
      title: 'Đã tùy chỉnh',
      render: (_, r) => {
        const keys = Object.keys(r.overrides) as OverridableBossBattleConfigKey[];
        if (keys.length === 0) {
          return <Text type="secondary">Dùng template chung</Text>;
        }
        return (
          <Space size={[4, 4]} wrap>
            {keys.map((k) => (
              <Tag color="orange" key={k}>
                {FIELD_LABELS[k] ?? k}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Hành động',
      width: 280,
      render: (_, r) => (
        <Space>
          <Tooltip title={r.weekStarted ? 'Tuần đã bắt đầu chạy — không thể chỉnh override' : ''}>
            <Button
              size="small"
              icon={<EditOutlined />}
              // disabled={r.weekStarted}
              onClick={() => {
                setEditingGrade(r.gradeLevel);
                setEditModalOpen(true);
              }}
            >
              Tùy chỉnh
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => setSetsModalGrade(r.gradeLevel)}
          >
            Bộ câu hỏi
          </Button>
          <Popconfirm
            title="Xóa override?"
            description="Khối này sẽ dùng template mặc định."
            onConfirm={() => handleResetOverride(r.gradeLevel)}
            okText="Reset"
            cancelText="Hủy"
            disabled={r.weekStarted || Object.keys(r.overrides).length === 0}
          >
            <Tooltip title={r.weekStarted ? 'Tuần đã bắt đầu chạy — không thể reset override' : ''}>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                disabled={r.weekStarted || Object.keys(r.overrides).length === 0}
              >
                Reset
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Khối được chọn nhưng chưa đủ câu hỏi trong kho → cảnh báo & chặn khởi tạo
  const initShortGrades = initGrades.filter((g) => (questionCounts[g] ?? 0) < requiredPerWeek);

  return (
    <div>
      <Title level={4}>Cấu hình theo tuần × khối</Title>
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
          <Button icon={<ReloadOutlined />} onClick={load}>
            Tải lại
          </Button>
          <Tooltip
            title={
              isWeekStartedClient(weekKey)
                ? 'Tuần đã bắt đầu chạy — không thể thêm khối / override mới'
                : ''
            }
          >
            <Button
              icon={<PlusOutlined />}
              onClick={openAddGrades}
              disabled={isWeekStartedClient(weekKey)}
            >
              Thêm khối
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={openInit}>
            Khởi tạo tuần mới
          </Button>
        </Space>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Các chỉnh sửa riêng chỉ có hiệu lực khi bạn <b>Khởi tạo tuần</b> mới. Tuần đang chạy sẽ
          giữ nguyên cấu hình đã lưu tại thời điểm khởi tạo. Những thông số không chỉnh riêng sẽ
          tự động dùng giá trị từ trang "Cấu hình mặc định".
        </Text>
      </Card>

      <Card>
        <Table<BossWeeklyConfig>
          rowKey="gradeLevel"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={false}
        />
      </Card>

      <WeeklyConfigEditModal
        open={editModalOpen}
        weekKey={weekKey}
        item={editingItem}
        onClose={() => setEditModalOpen(false)}
        onSaved={() => {
          setEditModalOpen(false);
          load();
        }}
      />

      <Modal
        title={`Bộ câu hỏi — Tuần ${weekKey} — Khối ${setsModalGrade ?? ''}`}
        open={setsModalGrade != null}
        onCancel={() => setSetsModalGrade(null)}
        footer={null}
        width={900}
        destroyOnHidden
      >
        {setsModalGrade != null && (
          <QuestionSetsPage weekKey={weekKey} grade={setsModalGrade} lockGrade embedded />
        )}
      </Modal>

      <Modal
        title="Khởi tạo tuần mới"
        open={initOpen}
        onCancel={() => setInitOpen(false)}
        onOk={handleInit}
        confirmLoading={initLoading}
        okText="Khởi tạo"
        cancelText="Hủy"
        okButtonProps={{ disabled: initShortGrades.length > 0 }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong>Tuần:</Text>
        </div>
        <Select
          showSearch
          value={initWeekKey}
          onChange={setInitWeekKey}
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="Chọn tuần"
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          options={weekOptions.map((w) => ({
            ...w,
            disabled: initializedWeeks.includes(w.value),
            label: initializedWeeks.includes(w.value) ? `${w.label}  — đã khởi tạo` : w.label,
          }))}
        />
        <div style={{ marginBottom: 8 }}>
          <Text strong>Khối cần khởi tạo:</Text>
        </div>
        <Select
          mode="multiple"
          value={initGrades}
          onChange={setInitGrades}
          style={{ width: '100%' }}
          placeholder="Chọn khối"
          options={BOSS_BATTLE_GRADES.map((g) => {
            const count = questionCounts[g] ?? 0;
            const short = count < requiredPerWeek;
            return {
              value: g,
              label: short
                ? `Khối ${g} — thiếu câu hỏi (${count}/${requiredPerWeek})`
                : `Khối ${g} (${count} câu)`,
            };
          })}
        />
        {initShortGrades.length > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message={`Chưa đủ ${requiredPerWeek} câu hỏi`}
            description={
              <>
                Không thể khởi tạo: các khối sau chưa đủ {requiredPerWeek} câu hỏi trong kho —{' '}
                {initShortGrades
                  .map((g) => `Khối ${g} (${questionCounts[g] ?? 0}/${requiredPerWeek})`)
                  .join(', ')}
                . Vui lòng bổ sung câu hỏi (tab "Ngân hàng câu hỏi") rồi thử lại.
              </>
            }
          />
        )}
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          Các tuần đã có BossInstance sẽ bị vô hiệu hóa. Mặc định chọn sẵn khối đang mở cho tuần
          hiện tại — có thể thêm/bớt tùy ý.
        </Text>
      </Modal>

      <Modal
        title={`Thêm khối vào tuần ${weekKey}`}
        open={addGradesOpen}
        onCancel={() => setAddGradesOpen(false)}
        onOk={handleAddGrades}
        confirmLoading={addingGrades}
        okText="Thêm"
        cancelText="Hủy"
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong>Chọn khối muốn mở cho tuần này:</Text>
        </div>
        <Select
          mode="multiple"
          value={addGradesSelected}
          onChange={setAddGradesSelected}
          style={{ width: '100%' }}
          placeholder="Chọn khối"
          options={BOSS_BATTLE_GRADES.filter(
            (g) => !items.some((i) => i.gradeLevel === g),
          ).map((g) => ({ label: `Khối ${g}`, value: g }))}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          Khối mới sẽ xuất hiện trong bảng với cấu hình = template mặc định.
          Sau đó bấm "Khởi tạo tuần mới" để tạo BossInstance.
        </Text>
      </Modal>
    </div>
  );
}

// ============================================================
// OverrideToggleState — must be declared before FieldRow
// ============================================================

interface OverrideToggleState {
  hpMax: boolean;
  questionsPerDay: boolean;
  questionsPerWeek: boolean;
  basePoint: boolean;
  maxSpeedBonus: boolean;
  tMaxSec: boolean;
  bossName: boolean;
  bossStates: boolean;
}

// ============================================================
// FieldRow — extracted to module scope to avoid remount on every parent render
// (defining inside render causes React to unmount/remount, losing input focus)
// ============================================================

function FieldRow({
  name,
  label,
  enabled,
  onToggle,
  children,
}: {
  name: keyof OverrideToggleState;
  label: string;
  enabled: boolean;
  onToggle: (key: keyof OverrideToggleState, v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 12,
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <Space>
        <Switch
          size="small"
          checked={enabled}
          onChange={(v) => onToggle(name, v)}
        />
        <Text strong={enabled} type={enabled ? undefined : 'secondary'}>
          {label}
        </Text>
      </Space>
      <div style={{ opacity: enabled ? 1 : 0.5 }}>{children}</div>
    </div>
  );
}

// ============================================================
// Edit modal
// ============================================================

interface EditModalProps {
  open: boolean;
  weekKey: string;
  item: BossWeeklyConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

function WeeklyConfigEditModal({ open, weekKey, item, onClose, onSaved }: EditModalProps) {
  const [form] = Form.useForm();
  const [enabled, setEnabled] = useState<OverrideToggleState>({
    hpMax: false,
    questionsPerDay: false,
    questionsPerWeek: false,
    basePoint: false,
    maxSpeedBonus: false,
    tMaxSec: false,
    bossName: false,
    bossStates: false,
  });
  const [states, setStates] = useState<BossStateImage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    const o = item.overrides;
    const eff = item.effectiveConfig;
    setEnabled({
      hpMax: o.hpMax !== undefined,
      questionsPerDay: o.questionsPerDay !== undefined,
      questionsPerWeek: o.questionsPerWeek !== undefined,
      basePoint: o.basePoint !== undefined,
      maxSpeedBonus: o.maxSpeedBonus !== undefined,
      tMaxSec: o.tMaxSec !== undefined,
      bossName: o.bossName !== undefined,
      bossStates: o.bossStates !== undefined,
    });
    form.setFieldsValue({
      hpMax: eff.hpMax,
      questionsPerDay: eff.questionsPerDay,
      questionsPerWeek: eff.questionsPerWeek,
      basePoint: eff.basePoint,
      maxSpeedBonus: eff.maxSpeedBonus,
      tMaxSec: eff.tMaxSec,
      bossName: eff.bossName,
    });
    setStates(eff.bossStates ?? []);
  }, [open, item, form]);

  const toggle = useCallback(
    (key: keyof OverrideToggleState, v: boolean) =>
      setEnabled((s) => ({ ...s, [key]: v })),
    [],
  );

  const handleSave = async () => {
    if (!item) return;
    try {
      const values = await form.validateFields();
      const overrides: BossBattleConfigOverride = {};
      if (enabled.hpMax) overrides.hpMax = values.hpMax;
      if (enabled.questionsPerDay) overrides.questionsPerDay = values.questionsPerDay;
      if (enabled.questionsPerWeek) overrides.questionsPerWeek = values.questionsPerWeek;
      if (enabled.basePoint) overrides.basePoint = values.basePoint;
      if (enabled.maxSpeedBonus) overrides.maxSpeedBonus = values.maxSpeedBonus;
      if (enabled.tMaxSec) overrides.tMaxSec = values.tMaxSec;
      if (enabled.bossName) overrides.bossName = values.bossName;
      if (enabled.bossStates) overrides.bossStates = states;

      setSaving(true);
      await bossBattleService.upsertWeeklyConfig(weekKey, item.gradeLevel, overrides);
      message.success('Đã lưu override');
      onSaved();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal
      title={`Override khối ${item.gradeLevel} — Tuần ${weekKey}`}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="Lưu chỉnh sửa"
      cancelText="Hủy"
      width={760}
      destroyOnHidden
    >
      {item.hasInstance && (
        <Tag color="warning" style={{ marginBottom: 12 }}>
          Tuần này đã được khởi tạo. Các thay đổi sẽ chưa có hiệu lực cho tới khi khởi tạo lại
          tuần (tính năng khởi tạo lại hiện chưa hỗ trợ).
        </Tag>
      )}
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Bật công tắc ở mỗi dòng để chỉnh riêng thông số đó cho khối này. Thông số không bật sẽ tự
        động dùng giá trị trong "Cấu hình mặc định".
      </Text>

      <Form form={form} layout="horizontal">
        <FieldRow name="bossName" label="Tên Boss" enabled={enabled.bossName} onToggle={toggle}>
          <Form.Item name="bossName" noStyle rules={[{ required: enabled.bossName }]}>
            <Input disabled={!enabled.bossName} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="hpMax" label="HP tối đa" enabled={enabled.hpMax} onToggle={toggle}>
          <Form.Item name="hpMax" noStyle rules={[{ required: enabled.hpMax }]}>
            <InputNumber min={1} style={{ width: '100%' }} disabled={!enabled.hpMax} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="questionsPerDay" label="Số câu/ngày" enabled={enabled.questionsPerDay} onToggle={toggle}>
          <Form.Item name="questionsPerDay" noStyle rules={[{ required: enabled.questionsPerDay }]}>
            <InputNumber min={1} max={50} style={{ width: '100%' }} disabled={!enabled.questionsPerDay} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="questionsPerWeek" label="Tổng câu/tuần" enabled={enabled.questionsPerWeek} onToggle={toggle}>
          <Form.Item name="questionsPerWeek" noStyle rules={[{ required: enabled.questionsPerWeek }]}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} disabled={!enabled.questionsPerWeek} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="basePoint" label="Điểm cơ bản/câu" enabled={enabled.basePoint} onToggle={toggle}>
          <Form.Item name="basePoint" noStyle rules={[{ required: enabled.basePoint }]}>
            <InputNumber min={0} style={{ width: '100%' }} disabled={!enabled.basePoint} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="maxSpeedBonus" label="Điểm tốc độ tối đa" enabled={enabled.maxSpeedBonus} onToggle={toggle}>
          <Form.Item name="maxSpeedBonus" noStyle rules={[{ required: enabled.maxSpeedBonus }]}>
            <InputNumber min={0} style={{ width: '100%' }} disabled={!enabled.maxSpeedBonus} />
          </Form.Item>
        </FieldRow>
        <FieldRow name="tMaxSec" label="Thời gian tối đa/câu (s)" enabled={enabled.tMaxSec} onToggle={toggle}>
          <Form.Item name="tMaxSec" noStyle rules={[{ required: enabled.tMaxSec }]}>
            <InputNumber min={5} max={300} style={{ width: '100%' }} disabled={!enabled.tMaxSec} />
          </Form.Item>
        </FieldRow>

        <FieldRow name="bossStates" label="Trạng thái Boss theo % HP" enabled={enabled.bossStates} onToggle={toggle}>
          <BossStatesEditor
            value={states}
            disabled={!enabled.bossStates}
            onChange={setStates}
          />
        </FieldRow>
      </Form>
    </Modal>
  );
}

// ============================================================
// BossStates editor
// ============================================================

function BossStatesEditor({
  value,
  disabled,
  onChange,
}: {
  value: BossStateImage[];
  disabled?: boolean;
  onChange: (v: BossStateImage[]) => void;
}) {
  const update = (idx: number, patch: Partial<BossStateImage>) => {
    const next = value.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };
  const add = () => onChange([...value, { minPercent: 0, maxPercent: 100, img: '' }]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div>
      <Table<BossStateImage>
        size="small"
        rowKey={(_, i) => `${i}`}
        pagination={false}
        dataSource={value}
        columns={[
          {
            title: 'minPercent',
            width: 110,
            render: (_, r, i) => (
              <InputNumber
                disabled={disabled}
                min={0}
                max={100}
                value={r.minPercent}
                onChange={(v) => update(i, { minPercent: Number(v) })}
              />
            ),
          },
          {
            title: 'maxPercent',
            width: 110,
            render: (_, r, i) => (
              <InputNumber
                disabled={disabled}
                min={0}
                max={100}
                value={r.maxPercent}
                onChange={(v) => update(i, { maxPercent: Number(v) })}
              />
            ),
          },
          {
            title: 'img',
            render: (_, r, i) => (
              <Input
                disabled={disabled}
                value={r.img}
                onChange={(e) => update(i, { img: e.target.value })}
              />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_, __, i) => (
              <Button danger size="small" disabled={disabled} onClick={() => remove(i)}>
                ×
              </Button>
            ),
          },
        ]}
      />
      <Button size="small" style={{ marginTop: 8 }} onClick={add} disabled={disabled}>
        + Thêm trạng thái
      </Button>
      <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
        Các field overridable: {OVERRIDABLE_BOSS_BATTLE_FIELDS.join(', ')}.
      </Text>
    </div>
  );
}

export default WeeklyConfigPage;
