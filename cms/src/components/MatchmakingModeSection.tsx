import { Form, InputNumber, Slider, Typography, Row, Col, Radio } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Section cấu hình ghép đối thủ — dùng chung cho Quiz Arena / Gomoku / Card Flip.
 *
 * Yêu cầu form cha có các field: `opponentMode`, `matchmakingTimeout`, `botActivationSeconds`.
 *
 * Hành vi backend tương ứng:
 * - `mixed`:    0 → botActivationSeconds chỉ tìm người thật; nếu không có, bot được ghép
 *               tại một thời điểm NGẪU NHIÊN trong [botActivationSeconds, matchmakingTimeout].
 * - `bot_only`: luôn ghép bot tại một thời điểm ngẫu nhiên trong [0, matchmakingTimeout]
 *               (vẫn hiển thị màn "đang tìm").
 *
 * Đặt section này NGAY SAU field `matchmakingTimeout` trong form.
 */
export function MatchmakingModeSection() {
  return (
    <>
      <Form.Item
        name="opponentMode"
        label="Chế độ ghép đối thủ"
        rules={[{ required: true, message: 'Bắt buộc' }]}
        tooltip="Chỉ đấu bot, hoặc tìm người thật trước rồi mới ghép bot khi không tìm được"
      >
        <Radio.Group optionType="button" buttonStyle="solid">
          <Radio.Button value="mixed">
            <UserOutlined /> Có cả người thật
          </Radio.Button>
          <Radio.Button value="bot_only">
            <RobotOutlined /> Chỉ đấu bot
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {/* Hidden để giá trị botActivationSeconds luôn được submit kèm form */}
      <Form.Item name="botActivationSeconds" hidden>
        <InputNumber />
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prev, cur) =>
          prev.matchmakingTimeout !== cur.matchmakingTimeout ||
          prev.botActivationSeconds !== cur.botActivationSeconds ||
          prev.opponentMode !== cur.opponentMode
        }
      >
        {({ getFieldValue, setFieldsValue }) => {
          const mode = getFieldValue('opponentMode') || 'mixed';
          const totalTime = getFieldValue('matchmakingTimeout') || 30;

          if (mode === 'bot_only') {
            return (
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary">
                  <RobotOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                  Luôn ghép với bot. Hệ thống vẫn hiển thị màn "đang tìm" và ghép bot tại một
                  thời điểm <strong>ngẫu nhiên</strong> trong vòng {totalTime}s.
                </Text>
              </div>
            );
          }

          // mode = 'mixed'
          const botActivation = getFieldValue('botActivationSeconds') || Math.round(totalTime / 2);
          const realPlayerPercent = Math.round((botActivation / totalTime) * 100);

          return (
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Phân bổ thời gian tìm trận
              </Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Kéo thanh để chọn mốc bắt đầu cho phép ghép bot. Sau mốc này, bot sẽ được ghép
                tại một thời điểm <strong>ngẫu nhiên</strong> (không phải lúc nào cũng đợi hết giờ).
              </Text>

              <Slider
                value={realPlayerPercent}
                min={20}
                max={90}
                tooltip={{
                  formatter: (value) => `${value}% (${Math.round((totalTime * (value || 0)) / 100)}s)`,
                }}
                onChange={(percent: number) => {
                  const newBotActivation = Math.max(1, Math.round((totalTime * percent) / 100));
                  setFieldsValue({ botActivationSeconds: newBotActivation });
                }}
                marks={{ 20: '20%', 50: '50%', 80: '80%' }}
              />

              {/* Visual timeline */}
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
                    Ghép bot (ngẫu nhiên)
                  </span>
                </div>
              </div>

              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <UserOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                    0s → {botActivation}s: Chỉ tìm người thật
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <RobotOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                    {botActivation}s → {totalTime}s: Ghép bot tại thời điểm ngẫu nhiên
                  </Text>
                </Col>
              </Row>
            </div>
          );
        }}
      </Form.Item>
    </>
  );
}

export default MatchmakingModeSection;
