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
  Input,
  Select,
  Divider,
} from 'antd';
import {
  SaveOutlined,
  ClearOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../../stores/config.store';
import { MatchmakingModeSection, CardFlipImportImagesModal } from '../../components';
import type { CardFlipImportMode } from '../../components/CardFlipImportImagesModal';
import type { CardFlipConfig, CardFlipItem } from '@uniclub/shared';

const { Title, Text } = Typography;

export function CardFlipConfigPage() {
  const [form] = Form.useForm<CardFlipConfig>();
  const [saving, setSaving] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Theo dõi field qua useWatch thay vì gọi form.getFieldValue lúc render
  // (tránh warning "useForm is not connected to any Form element").
  const pairCount = Form.useWatch('pairCount', form);
  const cardItems = Form.useWatch('cardItems', form) as CardFlipItem[] | undefined;

  const { cardFlip, isLoading, loadConfigs, updateCardFlip, invalidateCache } = useConfigStore();

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (cardFlip) {
      form.setFieldsValue(cardFlip);
    }
  }, [cardFlip, form]);

  const handleSave = async (values: CardFlipConfig) => {
    setSaving(true);
    try {
      // Lọc cardItems rỗng
      const cleanedValues = {
        ...values,
        cardItems: values.cardItems?.filter((item) => item?.value?.trim()),
      };
      await updateCardFlip(cleanedValues);
      message.success('Đã lưu cấu hình Lật Thẻ Bài');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleInvalidateCache = async () => {
    setInvalidating(true);
    try {
      await invalidateCache('card_flip');
      message.success('Đã xóa cache Lật Thẻ Bài');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Xóa cache thất bại');
    } finally {
      setInvalidating(false);
    }
  };

  const handleImportImages = (urls: string[], mode: CardFlipImportMode) => {
    const newItems: CardFlipItem[] = urls.map((value) => ({ type: 'image', value }));
    const current: CardFlipItem[] = form.getFieldValue('cardItems') || [];
    const next = mode === 'overwrite' ? newItems : [...current, ...newItems];
    form.setFieldValue('cardItems', next);
    setImportOpen(false);
    message.success(
      `Đã ${mode === 'overwrite' ? 'ghi đè' : 'thêm'} ${newItems.length} ảnh. Nhấn "Lưu cấu hình" để lưu.`,
    );
  };

  if (isLoading && !cardFlip) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>Đang tải cấu hình...</div>
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Cấu hình Lật Thẻ Bài</Title>

      <Card style={{ maxWidth: 800 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={cardFlip || undefined}
        >
          <Form.Item
            name="matchmakingTimeout"
            label="Thời gian tìm trận tối đa (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Thời gian chờ ghép đối thủ trước khi chuyển sang đấu AI"
          >
            <InputNumber min={10} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <MatchmakingModeSection />

          <Form.Item
            name="winPoints"
            label="Cúp thưởng khi thắng"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số Cúp người chơi nhận được khi thắng trận"
          >
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="pairCount"
            label="Số cặp thẻ"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Số cặp thẻ trong một trận (VD: 8 = 16 thẻ)"
          >
            <InputNumber min={4} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="botFlipDelayMs"
            label="Tốc độ lật thẻ của bot (mili giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Độ trễ giữa các thao tác lật của bot. Số càng lớn bot lật càng chậm (VD: 900 = 0.9 giây). Lưu ý: ở chế độ Nâng cao, độ trễ này tiêu vào quỹ giờ của bot."
          >
            <InputNumber min={200} max={3000} step={100} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">Chế độ Cơ bản</Divider>
          <Form.Item
            name="basicTotalTime"
            label="Tổng thời gian trận (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Đồng hồ chung cho cả trận ở chế độ Cơ bản. Hết giờ → người điểm cao thắng / hòa."
          >
            <InputNumber min={10} max={600} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">Chế độ Nâng cao</Divider>
          <Form.Item
            name="advancedStartTime"
            label="Thời gian xuất phát mỗi người (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Quỹ giờ ban đầu của mỗi người chơi (đồng hồ cờ vua). Hết quỹ giờ → thua ngay."
          >
            <InputNumber min={5} max={300} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="timeBonusOnMatch"
            label="Thời gian cộng thêm khi ghép đúng (giây)"
            rules={[{ required: true, message: 'Bắt buộc' }]}
            tooltip="Lượng thời gian cộng vào quỹ giờ khi người chơi ghép đúng một cặp (chế độ Nâng cao)."
          >
            <InputNumber min={0} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">Hình ảnh thẻ (tùy chọn)</Divider>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Để trống để dùng emoji mặc định. Thêm ít nhất {pairCount || 8} item.
          </Text>

          <Form.List name="cardItems">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space
                    key={key}
                    style={{ display: 'flex', marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true, message: 'Chọn loại' }]}
                    >
                      <Select style={{ width: 100 }}>
                        <Select.Option value="emoji">Emoji</Select.Option>
                        <Select.Option value="image">Ảnh URL</Select.Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: 'Nhập giá trị' }]}
                    >
                      <Input
                        placeholder={
                          form.getFieldValue(['cardItems', name, 'type']) === 'image'
                            ? 'https://example.com/image.png'
                            : '🍎'
                        }
                        style={{ width: 300 }}
                      />
                    </Form.Item>

                    {/* Preview */}
                    <CardItemPreview item={form.getFieldValue(['cardItems', name])} />

                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Space style={{ width: '100%' }} direction="vertical">
                    <Button
                      type="dashed"
                      onClick={() => add({ type: 'emoji', value: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      Thêm item
                    </Button>
                    <Button
                      type="dashed"
                      onClick={() => setImportOpen(true)}
                      block
                      icon={<PictureOutlined />}
                    >
                      Import ảnh (URL)
                    </Button>
                  </Space>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Lưu cấu hình
              </Button>

              <Popconfirm
                title="Xóa cache Lật Thẻ Bài?"
                description="Cache sẽ được xây dựng lại khi có request mới."
                onConfirm={handleInvalidateCache}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button icon={<ClearOutlined />} loading={invalidating}>
                  Xóa cache
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <CardFlipImportImagesModal
        open={importOpen}
        existingImageCount={(cardItems || []).filter((i) => i?.value?.trim()).length}
        onCancel={() => setImportOpen(false)}
        onImport={handleImportImages}
      />
    </div>
  );
}

function CardItemPreview({ item }: { item?: CardFlipItem }) {
  if (!item?.value) return null;

  if (item.type === 'image') {
    return (
      <img
        src={item.value}
        alt="preview"
        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return <span style={{ fontSize: 24 }}>{item.value}</span>;
}

export default CardFlipConfigPage;
