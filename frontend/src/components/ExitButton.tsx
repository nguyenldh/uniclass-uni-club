// ============================================================
// ExitButton — nút thoát game WebView (dấu X)
// Chỉ hiển thị tại trang chủ (lobby) của mỗi phần chơi.
// Bắn postMessage 'app:exit' ra parent app (UniClass).
// ============================================================

import React from 'react';
import { exitWebView } from '../utils/webview';

export interface ExitButtonProps {
  /** Route hiện tại — gửi kèm trong payload để parent biết thoát từ đâu */
  from?: string;
  /** Lý do thoát — mặc định 'user_action' */
  reason?: string;
  /** Class name tuỳ chỉnh */
  className?: string;
  /** Style tuỳ chỉnh */
  style?: React.CSSProperties;
  /** Handler bổ sung khi click (chạy trước exitWebView) */
  onClick?: () => void;
  /** Nội dung hiển thị — mặc định '✕' */
  children?: React.ReactNode;
}

export function ExitButton({
  from,
  reason = 'user_action',
  className,
  style,
  onClick,
  children,
}: ExitButtonProps) {
  const handleClick = () => {
    if (onClick) onClick();
    exitWebView(from, reason);
  };

  return (
    <button
      type="button"
      className={className ?? 'exit-button'}
      style={style}
      onClick={handleClick}
      aria-label="Thoát"
      title="Thoát"
    >
      {children ?? '✕'}
    </button>
  );
}