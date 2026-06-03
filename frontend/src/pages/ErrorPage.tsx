// ============================================================
// ErrorPage — hiển thị lỗi xác thực / lỗi hệ thống
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { GameCanvas, GameButton } from '../design-system/game';

export function ErrorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = (location.state as { message?: string } | null)?.message ?? 'Đã xảy ra lỗi không xác định.';

  return (
    <GameCanvas
      className="error-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 32,
      }}
    >
      <div style={{ fontSize: 64 }}>⚠️</div>
      <h1 style={{ color: '#fff', fontSize: 28, margin: 0, textAlign: 'center' }}>
        Rất tiếc!
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, margin: 0, textAlign: 'center', maxWidth: 400 }}>
        {message}
      </p>
    </GameCanvas>
  );
}
