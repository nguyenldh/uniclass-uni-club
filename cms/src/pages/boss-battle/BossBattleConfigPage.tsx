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
  Table,
  Space,
  Popconfirm,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../stores/config.store';
import { DEFAULT_BOSS_BATTLE_CONFIG } from '@uniclub/shared';
import type { BossBattleConfig, BossStateImage } from '@uniclub/shared';

const { Title } = Typography;

export function BossBattleConfigPage() {
  const [form] = Form.useForm<Omit<BossBattleConfig, 'bossStates'>>();
  const [states, setStates] = useState<BossStateImage[]>([]);
  const [saving, setSaving] = useState(false);
  const { bossBattle, isLoading, loadConfigs, updateBossBattle } = useConfigStore();

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    const cfg = bossBattle ?? DEFAULT_BOSS_BATTLE_CONFIG;
    form.setFieldsValue({
      hpMax: cfg.hpMax,
      questionsPerDay: cfg.questionsPerDay,
      questionsPerWeek: cfg.questionsPerWeek,
      basePoint: cfg.basePoint,
      maxSpeedBonus: cfg.maxSpeedBonus,
      tMaxSec: cfg.tMaxSec,
      bossName: cfg.bossName,
      weeklyFrameImageUrl: cfg.weeklyFrameImageUrl,
    });
    setStates(cfg.bossStates ?? []);
  }, [bossBattle, form]);

  const handleSave = async (values: Omit<BossBattleConfig, 'bossStates'>) => {
    setSaving(true);
    try {
      const merged: BossBattleConfig = { ...values, bossStates: states };
      await updateBossBattle(merged);
      message.success('Đã lưu cấu hình Săn Quái Vật');
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !bossBattle) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình Săn Quái Vật</Title>
      <Card style={{ maxWidth: 900 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Divider orientation="left">Thông số chung</Divider>
          <Form.Item name="bossName" label="Tên Quái Vật" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="hpMax" label="Tổng HP Quái Vật" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="questionsPerDay" label="Số câu mỗi ngày" rules={[{ required: true }]}>
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="questionsPerWeek" label="Tổng câu/tuần" rules={[{ required: true }]}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="basePoint" label="Điểm cơ bản/câu đúng" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxSpeedBonus" label="Điểm tốc độ tối đa" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tMaxSec" label="Thời gian tối đa/câu (giây)" rules={[{ required: true }]}>
            <InputNumber min={5} max={300} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="weeklyFrameImageUrl" label="URL khung 'Dũng sĩ diệt Quái Vật'">
            <Input placeholder="https://..." />
          </Form.Item>

          <Divider orientation="left">Trạng thái Quái Vật theo % HP còn lại</Divider>
          <Table<BossStateImage>
            rowKey={(_, idx) => String(idx)}
            dataSource={states}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Min %',
                dataIndex: 'minPercent',
                render: (_, record, idx) => (
                  <InputNumber
                    min={0}
                    max={100}
                    value={record.minPercent}
                    onChange={(v) => {
                      const next = [...states];
                      next[idx] = { ...next[idx], minPercent: Number(v ?? 0) };
                      setStates(next);
                    }}
                  />
                ),
              },
              {
                title: 'Max %',
                dataIndex: 'maxPercent',
                render: (_, record, idx) => (
                  <InputNumber
                    min={0}
                    max={100}
                    value={record.maxPercent}
                    onChange={(v) => {
                      const next = [...states];
                      next[idx] = { ...next[idx], maxPercent: Number(v ?? 0) };
                      setStates(next);
                    }}
                  />
                ),
              },
              {
                title: 'Ảnh (img/URL)',
                dataIndex: 'img',
                render: (_, record, idx) => (
                  <Input
                    value={record.img}
                    onChange={(e) => {
                      const next = [...states];
                      next[idx] = { ...next[idx], img: e.target.value };
                      setStates(next);
                    }}
                  />
                ),
              },
              {
                title: '',
                width: 60,
                render: (_, __, idx) => (
                  <Popconfirm
                    title="Xóa mốc này?"
                    onConfirm={() => setStates(states.filter((_, i) => i !== idx))}
                  >
                    <Button danger icon={<DeleteOutlined />} size="small" />
                  </Popconfirm>
                ),
              },
            ]}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            style={{ marginTop: 8 }}
            onClick={() => setStates([...states, { minPercent: 0, maxPercent: 100, img: '' }])}
          >
            Thêm mốc
          </Button>

          <Divider />
          <Space>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
              Lưu cấu hình
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}

export default BossBattleConfigPage;
