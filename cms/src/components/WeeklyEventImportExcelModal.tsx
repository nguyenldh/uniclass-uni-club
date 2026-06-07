import { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, Typography, message, Space, Alert } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  parseWeeklyEventExamsFromExcel,
  generateWeeklyEventExamTemplate,
  type WeeklyEventExamParseResult,
} from '../utils/weekly-event-excel';
import { weeklyEventService } from '../services/weekly-event.service';

const { Text } = Typography;

interface WeeklyEventImportExcelModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export function WeeklyEventImportExcelModal({ open, onCancel, onSuccess }: WeeklyEventImportExcelModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parseResult, setParseResult] = useState<WeeklyEventExamParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseWeeklyEventExamsFromExcel(file);
      setParseResult(result);
      if (result.errors.length > 0) {
        message.warning(`Có ${result.errors.length} lỗi khi parse`);
      }
    } catch {
      message.error('Không thể đọc file Excel');
    } finally {
      setParsing(false);
    }
    return false;
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.exams.length === 0) {
      message.warning('Không có đề thi hợp lệ để import');
      return;
    }
    setImporting(true);
    try {
      const result = await weeklyEventService.bulkCreateExams(parseResult.exams);
      const parts: string[] = [];
      if (result.createdCount > 0) parts.push(`tạo mới ${result.createdCount} đề`);
      if (result.errorCount > 0) parts.push(`${result.errorCount} lỗi`);
      message.success(`Đã import thành công: ${parts.join(', ')}`);
      if (result.errors.length > 0) {
        message.warning(`Có ${result.errors.length} đề bị lỗi khi import`);
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

  const examPreviewColumns = [
    { title: 'Tên đề', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Môn', dataIndex: 'subject', key: 'subject', width: 100 },
    { title: 'Khối', dataIndex: 'grade', key: 'grade', width: 60 },
    {
      title: 'Số câu',
      key: 'questionCount',
      width: 80,
      render: (_: unknown, record: any) => record.questions?.length || 0,
    },
  ];

  const errorColumns = [
    { title: 'Dòng', dataIndex: 'row', key: 'row', width: 60 },
    { title: 'Lỗi', dataIndex: 'message', key: 'message' },
  ];

  return (
    <Modal
      title="Import đề thi Sự kiện tuần từ Excel"
      open={open}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="template" icon={<DownloadOutlined />} onClick={generateWeeklyEventExamTemplate}>
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
          disabled={!parseResult || parseResult.exams.length === 0}
        >
          Import {parseResult?.exams.length || 0} đề thi
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          message="Định dạng file Excel"
          description="Mỗi dòng là 1 câu hỏi. Các dòng có cùng (Tên đề, Môn, Khối) sẽ được gộp thành 1 đề. Mỗi đề phải có đúng 25 câu."
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
                  <Text strong>{parseResult.exams.length}</Text> đề thi hợp lệ
                  {parseResult.errors.length > 0 && (
                    <>
                      <Text type="secondary">|</Text>
                      <Text type="danger">{parseResult.errors.length} lỗi</Text>
                    </>
                  )}
                </Space>
              }
            />

            {parseResult.exams.length > 0 && (
              <>
                <Text strong>Preview đề thi hợp lệ:</Text>
                <Table
                  columns={examPreviewColumns}
                  dataSource={parseResult.exams.slice(0, 5)}
                  rowKey={(_, i) => i!.toString()}
                  size="small"
                  pagination={false}
                />
                {parseResult.exams.length > 5 && (
                  <Text type="secondary">...và {parseResult.exams.length - 5} đề khác</Text>
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
