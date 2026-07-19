import { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, Typography, message, Space, Alert } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  parseBossQuestionsFromExcel,
  generateBossExcelTemplate,
  type BossParseResult,
} from '../utils/boss-excel';
import { bossBattleService } from '../services/boss-battle.service';

const { Text } = Typography;

interface BossImportExcelModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export function BossImportExcelModal({ open, onCancel, onSuccess }: BossImportExcelModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parseResult, setParseResult] = useState<BossParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseBossQuestionsFromExcel(file);
      setParseResult(result);
      if (result.errors.length > 0) {
        message.warning(`Có ${result.errors.length} dòng lỗi`);
      }
    } catch {
      message.error('Không thể đọc file Excel');
    } finally {
      setParsing(false);
    }
    return false;
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) {
      message.warning('Không có câu hỏi hợp lệ để import');
      return;
    }
    setImporting(true);
    try {
      const result = await bossBattleService.bulkUpsertQuestions(parseResult.rows);
      const parts: string[] = [];
      if (result.createdCount > 0) parts.push(`tạo mới ${result.createdCount}`);
      if (result.updatedCount > 0) parts.push(`cập nhật ${result.updatedCount}`);
      message.success(`Đã import thành công: ${parts.join(', ') || '0'}`);
      if (result.errors.length > 0) {
        message.warning(`Có ${result.errors.length} câu bị lỗi khi import`);
      }
      handleClose();
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFileList([]);
    setParseResult(null);
    onCancel();
  };

  const previewColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
      render: (id: string | undefined) =>
        id ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {id.slice(-6)}
          </Text>
        ) : (
          <Tag color="blue" style={{ fontSize: 11 }}>
            MỚI
          </Tag>
        ),
    },
    { title: 'Khối', dataIndex: 'grade', key: 'grade', width: 60 },
    { title: 'Nội dung', dataIndex: 'content', key: 'content', ellipsis: true },
    {
      title: 'Đáp án đúng',
      dataIndex: 'correctIndex',
      key: 'correctIndex',
      width: 100,
      render: (idx: number) => String.fromCharCode(65 + idx),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="blue">On</Tag> : <Tag>Off</Tag>),
    },
  ];

  const errorColumns = [
    { title: 'Dòng', dataIndex: 'row', key: 'row', width: 60 },
    { title: 'Lỗi', dataIndex: 'message', key: 'message' },
  ];

  return (
    <Modal
      title="Import câu hỏi Săn Quái Vật từ Excel"
      open={open}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="template" icon={<DownloadOutlined />} onClick={generateBossExcelTemplate}>
          Tải template mẫu
        </Button>,
        <Button key="cancel" onClick={handleClose}>
          Hủy
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handleImport}
          loading={importing}
          disabled={!parseResult || parseResult.rows.length === 0}
        >
          Import {parseResult?.rows.length || 0} câu hỏi
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          message={
            <span>
              Có thể nhập công thức toán bằng <code>$...$</code> trong ô nội dung/đáp án, ví dụ{' '}
              <code>{'$\\frac{a}{b}$'}</code>, <code>{'$x^2$'}</code>.
            </span>
          }
        />
        <Upload
          accept=".xlsx,.xls"
          fileList={fileList}
          beforeUpload={handleUpload}
          onChange={({ fileList }) => setFileList(fileList.slice(-1))}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />} loading={parsing}>
            Chọn file Excel
          </Button>
        </Upload>

        {parseResult && (
          <>
            <Alert
              type={parseResult.errors.length > 0 ? 'warning' : 'success'}
              message={
                <Space>
                  <Text strong>{parseResult.rows.length}</Text> câu hỏi hợp lệ
                  {parseResult.errors.length > 0 && (
                    <>
                      <Text type="secondary">|</Text>
                      <Text type="danger">{parseResult.errors.length} dòng lỗi</Text>
                    </>
                  )}
                </Space>
              }
            />

            {parseResult.rows.length > 0 && (
              <>
                <Text strong>Preview câu hỏi hợp lệ:</Text>
                <Table
                  columns={previewColumns}
                  dataSource={parseResult.rows.slice(0, 5)}
                  rowKey={(_, i) => i!.toString()}
                  size="small"
                  pagination={false}
                />
                {parseResult.rows.length > 5 && (
                  <Text type="secondary">...và {parseResult.rows.length - 5} câu khác</Text>
                )}
              </>
            )}

            {parseResult.errors.length > 0 && (
              <>
                <Text strong type="danger">
                  Các dòng bị lỗi:
                </Text>
                <Table
                  columns={errorColumns}
                  dataSource={parseResult.errors}
                  rowKey="row"
                  size="small"
                  pagination={false}
                />
              </>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}

export default BossImportExcelModal;
