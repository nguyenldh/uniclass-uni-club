import { useEffect, useState } from 'react';
import {
  Form,
  InputNumber,
  Button,
  Card,
  message,
  Space,
  Spin,
  Typography,
  Popconfirm,
  Slider,
  Divider,
  Modal,
  Switch,
  Select,
} from 'antd';
import { SaveOutlined, ClearOutlined, SyncOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../stores/config.store';
import { configService } from '../../services/config.service';
import { MatchmakingModeSection } from '../../components';
import type { QuizArenaConfig } from '@uniclub/shared';

const { Title, Text } = Typography;

export function QuizArenaConfigPage() {
  const [form] = Form.useForm<QuizArenaConfig>();
  const [saving, setSaving] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const { quizArena, isLoading, loadConfigs, updateQuizArena, invalidateCache } = useConfigStore();

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (quizArena) {
      form.setFieldsValue(quizArena);
    }
  }, [quizArena, form]);

  const handleSave = async (values: QuizArenaConfig) => {
    setSaving(true);
    try {
      await updateQuizArena(values);
      message.success('Đã lưu cấu hình So Tài');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleInvalidateCache = async () => {
    setInvalidating(true);
    try {
      await invalidateCache('quiz_arena');
      message.success('Đã xóa cache So Tài');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Xóa cache thất bại');
    } finally {
      setInvalidating(false);
    }
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const { count } = await configService.recomputeQuizDifficulty();
      Modal.success({
        title: 'Recompute hoàn tất',
        content: `Đã cập nhật độ khó cho ${count} câu hỏi.`,
      });
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Recompute thất bại');
    } finally {
      setRecomputing(false);
    }
  };

  if (isLoading && !quizArena) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>Đang tải cấu hình...</div>
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình So Tài</Title>

      <Card style={{ maxWidth: 800 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={quizArena || undefined}
        >
          {/* Section: Trận đấu */}
          <Divider orientation="left">Trận đấu</Divider>

          <Form.Item
            name="questionsPerMatch"
            label="Số câu hỏi mỗi trận"
            rules={[{ required: true, message: 'Bắt buộc' }]}
          >
            <InputNumber min={5} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxPointsPerQuestion"
            label="Điểm tối đa mỗi câu"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Điểm cao nhất có thể nhận được nếu trả lời đúng ngay lập tức"
          >
            <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="minScoreRetention"
            label="Hệ số bảo toàn điểm tối thiểu"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Trả lời đúng ở giây cuối vẫn nhận tối thiểu X% điểm"
          >
            <Slider min={0} max={1} step={0.05} marks={{ 0: '0%', 0.5: '50%', 1: '100%' }} />
          </Form.Item>

          <Form.Item
            name="uniPointsPerCorrect"
            label="Cúp mỗi câu đúng"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số Cúp đồng bộ về hệ thống cha khi trả lời đúng"
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="nextQuestionDelayMs"
            label="Độ trễ chuyển câu (ms)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Thời gian chờ trước khi chuyển sang câu hỏi tiếp theo"
          >
            <InputNumber min={1000} max={10000} step={500} style={{ width: '100%' }} />
          </Form.Item>

          {/* Section: Mời bạn / Tái đấu */}
          <Divider orientation="left">Mời bạn / Tái đấu</Divider>

          <Form.Item
            name="maxGamesPerRoom"
            label="Số ván tối đa mỗi phòng mời"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Tổng số ván tối đa trong một phòng mời bạn (tính cả ván đầu). VD 3 → tái đấu được 2 lần. Đặt 1 để tắt tái đấu."
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="inviteHostWinMultiplier"
            label="Hệ số nhân điểm cho người mời khi thắng"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Người tạo phòng (mời bạn) khi THẮNG sẽ nhận điểm × hệ số này. VD 2 → ×2 điểm. Đặt 1 để không nhân. Chỉ áp dụng cho người mời, không áp dụng cho người được mời."
          >
            <InputNumber min={1} max={10} step={0.5} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="inviteBlockSameDevice"
            label="Chặn 2 người chơi cùng thiết bị"
            valuePropName="checked"
            tooltip="Chống gian lận: chặn việc tự tạo tài khoản mới rồi tự chơi với mình trên cùng một máy (dựa trên browser fingerprint + IP). Tắt nếu học sinh dùng máy chung (phòng máy, thiết bị dùng chung)."
          >
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>

          {/* Section: Emoji khiêu khích */}
          <Divider orientation="left">Emoji khiêu khích</Divider>

          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Trong trận, người chơi có thể thả emoji để khiêu khích đối thủ. Người bị ném
            sẽ thấy hiệu ứng nhưng không bị cản trở việc trả lời câu hỏi.
          </Text>

          <Form.Item
            name="emojiEnabled"
            label="Bật tính năng thả emoji"
            valuePropName="checked"
            tooltip="Tắt để ẩn hoàn toàn nút thả emoji trong trận So Tài"
          >
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>

          <Form.Item
            name="emojiCooldownMs"
            label="Thời gian chờ giữa 2 lần thả (ms)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Khoảng thời gian tối thiểu giữa 2 lần thả emoji của cùng một người chơi (chống spam). VD 3000 = 3 giây."
          >
            <InputNumber min={0} max={60000} step={500} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="emojiPalette"
            label="Danh sách emoji"
            rules={[
              { required: true, message: 'Cần ít nhất 1 emoji' },
              {
                validator: (_, value) =>
                  Array.isArray(value) && value.length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('Cần ít nhất 1 emoji')),
              },
            ]}
            tooltip="Nhập từng emoji rồi nhấn Enter để thêm. Chỉ những emoji trong danh sách này mới được phép thả."
          >
            <Select
              mode="tags"
              tokenSeparators={[' ', ',']}
              placeholder="Nhập emoji rồi nhấn Enter (vd: 😜 🤪 🔥)"
              style={{ width: '100%' }}
              open={false}
              suffixIcon={null}
            />
          </Form.Item>

          {/* Section: Matchmaking */}
          <Divider orientation="left">Matchmaking</Divider>

          <Form.Item
            name="matchmakingTimeout"
            label="Tổng thời gian tìm trận (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Tổng thời gian tối đa để ghép cặp trước khi timeout"
          >
            <InputNumber min={10} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <MatchmakingModeSection />

          {/* @deprecated — giữ hidden để không mất giá trị cũ khi submit (backend không dùng) */}
          <Form.Item name="realPlayerSearchSeconds" hidden>
            <InputNumber />
          </Form.Item>

          {/* Section: Phân nhóm */}
          <Divider orientation="left">Phân nhóm năng lực</Divider>

          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            <strong>Câu hỏi:</strong> Phân loại dựa trên tỷ lệ người trả lời đúng (nhiều người đúng = câu dễ).<br />
            <strong>Học sinh:</strong> Phân loại dựa trên tỷ lệ trả lời đúng trong lịch sử (đúng ít = yếu → nhận câu dễ).
          </Text>

          <Form.Item
            name="easyQuestionThreshold"
            label="Ngưỡng câu hỏi Dễ (tỷ lệ đúng tối thiểu)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Câu hỏi có tỷ lệ đúng ≥ ngưỡng này được xếp là 'Dễ' (mặc định: 75%)"
          >
            <Slider min={0} max={1} step={0.05} marks={{ 0: '0%', 0.5: '50%', 1: '100%' }} />
          </Form.Item>

          <Form.Item
            name="hardQuestionThreshold"
            label="Ngưỡng câu hỏi Khó (tỷ lệ đúng tối đa)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Câu hỏi có tỷ lệ đúng ≤ ngưỡng này được xếp là 'Khó' (mặc định: 40%)"
          >
            <Slider min={0} max={1} step={0.05} marks={{ 0: '0%', 0.5: '50%', 1: '100%' }} />
          </Form.Item>

          <Form.Item
            name="easyPlayerThreshold"
            label="Ngưỡng học sinh Yếu (nhận câu dễ)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Học sinh có tỷ lệ đúng < ngưỡng này được xếp vào nhóm Yếu, sẽ được ghép với câu dễ (mặc định: 45%)"
          >
            <Slider min={0} max={1} step={0.05} marks={{ 0: '0%', 0.5: '50%', 1: '100%' }} />
          </Form.Item>

          <Form.Item
            name="hardPlayerThreshold"
            label="Ngưỡng học sinh Giỏi (nhận câu khó)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Học sinh có tỷ lệ đúng ≥ ngưỡng này được xếp vào nhóm Giỏi, sẽ được ghép với câu khó (mặc định: 75%)"
          >
            <Slider min={0} max={1} step={0.05} marks={{ 0: '0%', 0.5: '50%', 1: '100%' }} />
          </Form.Item>

          <Form.Item
            name="recentMatchesForAbility"
            label="Số trận gần nhất để tính phong độ"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Set 0 để dùng toàn bộ lịch sử"
          >
            <InputNumber min={0} max={20} style={{ width: '100%' }} />
          </Form.Item>

          {/* Section: AFK */}
          <Divider orientation="left">AFK</Divider>

          <Form.Item
            name="afkConsecutiveMisses"
            label="Số câu liên tiếp không trả lời → thua AFK"
            rules={[{ required: true, message: 'Bắt buộc' }]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>

          {/* Actions */}
          <Form.Item>
            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Lưu cấu hình
              </Button>

              <Popconfirm
                title="Xóa cache So Tài?"
                description="Cache sẽ được xây dựng lại khi có request mới."
                onConfirm={handleInvalidateCache}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button icon={<ClearOutlined />} loading={invalidating}>
                  Xóa cache
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Recompute độ khó toàn bộ câu hỏi?"
                description="Quá trình này có thể mất vài giây tùy số lượng câu hỏi."
                onConfirm={handleRecompute}
                okText="Recompute"
                cancelText="Hủy"
              >
                <Button icon={<SyncOutlined />} loading={recomputing}>
                  Recompute độ khó
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default QuizArenaConfigPage;
