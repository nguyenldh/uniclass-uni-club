// ============================================================
// ExitButton — nút thoát game WebView (dấu X hoặc chữ "Thoát")
// Chỉ hiển thị tại trang chủ (lobby) của mỗi phần chơi.
// Bấm nút sẽ mở popup xác nhận (tránh ấn nhầm), đồng ý mới
// bắn postMessage 'app:exit' ra parent app (UniClass).
// ============================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Handler bổ sung khi user XÁC NHẬN thoát (chạy trước exitWebView) */
  onClick?: () => void;
  /** Nội dung hiển thị — mặc định '✕' */
  children?: React.ReactNode;
  /** Tiêu đề popup xác nhận */
  confirmTitle?: string;
  /** Nội dung popup xác nhận */
  confirmMessage?: string;
}

export function ExitButton({
  from,
  reason = 'user_action',
  className,
  style,
  onClick,
  children,
  confirmTitle = 'Thoát game ?',
  confirmMessage = 'Bạn có chắc muốn thoát không?',
}: ExitButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(false);
    if (onClick) onClick();
    exitWebView(from, reason);
  };

  return (
    <>
      <button
        type="button"
        className={className ?? 'exit-button'}
        style={style}
        onClick={() => setConfirming(true)}
        aria-label="Thoát"
        title="Thoát"
      >
        {children ?? '✕'}
      </button>

      {confirming &&
        createPortal(
          <div className="exit-confirm-backdrop" onClick={() => setConfirming(false)}>
            <div
              className="exit-confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-label={confirmTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{confirmTitle}</h3>
              <p>{confirmMessage}</p>
              <div className="exit-confirm-actions">
                <button
                  type="button"
                  className="exit-confirm-btn stay"
                  onClick={() => setConfirming(false)}
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  className="exit-confirm-btn leave"
                  onClick={handleConfirm}
                >
                  Thoát
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
