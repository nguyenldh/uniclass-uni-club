import { GameCanvas, GameButton } from '../../design-system/game';
import { exitWebView } from '../../utils/webview';

export interface RoomNotFoundProps {
  /** Thông điệp phụ (mặc định: phòng không tồn tại hoặc đã hết hạn) */
  message?: string;
}

/**
 * Màn "Không tìm thấy phòng" — dùng cho guest khi phòng không tồn tại / hết hạn,
 * hoặc guest truy cập nhầm vào sảnh. Chỉ có nút Thoát (đóng WebView) vì guest
 * không được vào sảnh.
 */
export function RoomNotFound({ message }: RoomNotFoundProps) {
  return (
    <GameCanvas
      className="quiz-arena-lobby no-top"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>🔍</div>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>Không tìm thấy phòng</div>
      <div style={{ color: '#cbd5e1', textAlign: 'center', maxWidth: 340 }}>
        {message ?? 'Phòng không tồn tại hoặc đã hết hạn.'}
      </div>
      <GameButton color="orange" size="md" onClick={() => exitWebView('/quiz-arena')}>
        Thoát
      </GameButton>
    </GameCanvas>
  );
}

export default RoomNotFound;
