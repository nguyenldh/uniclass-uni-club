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
  Row,
  Col,
} from 'antd';
import { SaveOutlined, ClearOutlined, SyncOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useConfigStore } from '../../stores/config.store';
import { configService } from '../../services/config.service';
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
      message.success('Đã lưu cấu hình Quiz Arena');
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
      message.success('Đã xóa cache Quiz Arena');
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
        <Spin size="large" tip="Đang tải cấu hình..." />
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình Quiz Arena (So Tài)</Title>

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
            label="UniPoints mỗi câu đúng"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số UniPoints đồng bộ về UniClass khi trả lời đúng"
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

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.matchmakingTimeout !== currentValues.matchmakingTimeout ||
              prevValues.botActivationSeconds !== currentValues.botActivationSeconds
            }
          >
            {({ getFieldValue, setFieldsValue }) => {
              const totalTime = getFieldValue('matchmakingTimeout') || 30;
              const botActivation = getFieldValue('botActivationSeconds') || 15;
              const realPlayerPercent = Math.round((botActivation / totalTime) * 100);

              return (
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Phân bổ thời gian tìm trận
                  </Text>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Kéo thanh để điều chỉnh thời điểm hệ thống bắt đầu ghép bot
                  </Text>
                  
                  <Slider
                    value={realPlayerPercent}
                    min={20}
                    max={90}
                    tooltip={{
                      formatter: (value) => `${value}% (${Math.round((totalTime * (value || 0)) / 100)}s)`,
                    }}
                    onChange={(percent: number) => {
                      const newBotActivation = Math.round((totalTime * percent) / 100);
                      // realPlayerSearchSeconds luôn = botActivationSeconds - 1 (hoặc bằng nếu = min)
                      const newRealPlayer = Math.max(newBotActivation - 1, Math.round(totalTime * 0.2));
                      setFieldsValue({
                        botActivationSeconds: newBotActivation,
                        realPlayerSearchSeconds: newRealPlayer,
                      });
                    }}
                    marks={{
                      20: '20%',
                      50: '50%',
                      80: '80%',
                    }}
                  />

                  {/* Visual Timeline */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      borderRadius: 8,
                      overflow: 'hidden',
                      height: 48,
                      marginTop: 16,
                      border: '1px solid #d9d9d9',
                    }}
                  >
                    <div
                      style={{
                        flex: realPlayerPercent,
                        background: 'linear-gradient(90deg, #52c41a 0%, #95de64 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 500,
                        fontSize: 13,
                        padding: '0 8px',
                        minWidth: 0,
                      }}
                    >
                      <UserOutlined style={{ marginRight: 6 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Tìm người ({botActivation}s)
                      </span>
                    </div>
                    <div
                      style={{
                        flex: 100 - realPlayerPercent,
                        background: 'linear-gradient(90deg, #1890ff 0%, #69c0ff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 500,
                        fontSize: 13,
                        padding: '0 8px',
                        minWidth: 0,
                      }}
                    >
                      <RobotOutlined style={{ marginRight: 6 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Ghép bot ({totalTime - botActivation}s)
                      </span>
                    </div>
                  </div>

                  <Row gutter={16} style={{ marginTop: 12 }}>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <UserOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                        0s → {botActivation}s: Chỉ ghép người thật
                      </Text>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <RobotOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                        {botActivation}s → {totalTime}s: Cho phép ghép bot
                      </Text>
                    </Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>

          {/* Hidden fields để giữ giá trị */}
          <Form.Item name="realPlayerSearchSeconds" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="botActivationSeconds" hidden>
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
                title="Xóa cache Quiz Arena?"
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
