// ============================================================
// WebView Communication Utility — postMessage ra parent app
// ============================================================

import {
  WEBVIEW_MESSAGE_TYPES,
  WEBVIEW_MESSAGE_VERSION,
  SUB_GAME_TO_KAFKA,
  GAME_TYPE_TO_KAFKA,
} from '@uniclub/shared';
import type {
  WebViewMessage,
  WebViewMessageType,
  WebViewExitPayload,
  WebViewGameEndedPayload,
} from '@uniclub/shared';
import type { GameType } from '@uniclub/shared';

/**
 * Gửi message từ game WebView ra parent app (UniClass).
 *
 * Hỗ trợ 2 kênh:
 * 1. `window.ReactNativeWebView.postMessage` — cho React Native WebView
 * 2. `window.parent.postMessage` — cho iframe / browser fallback
 *
 * Format message luôn tuân theo WebViewMessage contract (version, timestamp).
 *
 * @example
 * ```ts
 * // Thoát game
 * postWebViewMessage('app:exit', { from: '/mind-game', reason: 'user_action' });
 *
 * // Game kết thúc
 * postWebViewMessage('game:ended', { gameType: 'mind_game', ... });
 *
 * // Không có payload
 * postWebViewMessage('app:ready');
 * ```
 */
export function postWebViewMessage<T = unknown>(
  type: WebViewMessageType,
  payload?: T,
): void {
  const message: WebViewMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
    version: WEBVIEW_MESSAGE_VERSION,
  };

  if (message.payload && (message.payload as any).userId) {
    (message.payload as any).profileId = (message.payload as any).userId; // Đồng bộ userId → profileId để backend dễ xử lý
  }

  const serialized = JSON.stringify(message);

  console.log("Webview posting Message: ", message);
  

  // Ưu tiên React Native WebView bridge
  const rnWebView = (window as unknown as Record<string, unknown>)
    .ReactNativeWebView as { postMessage: (msg: string) => void } | undefined;

  if (rnWebView && typeof rnWebView.postMessage === 'function') {
    rnWebView.postMessage(serialized);
    return;
  }

  // Fallback: postMessage cho iframe / browser
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(serialized, '*');
    return;
  }

  // Development fallback: log ra console
  if (import.meta.env.DEV) {
    console.log('[WebView] postMessage (no parent):', message);
  }
}

/**
 * Shortcut — thoát game WebView.
 *
 * @param from Route hiện tại (vd. '/mind-game')
 * @param reason Lý do thoát (mặc định 'user_action')
 */
export function exitWebView(
  from?: string,
  reason: string = 'user_action',
): void {
  const payload: WebViewExitPayload = { from, reason };
  postWebViewMessage<WebViewExitPayload>(
    WEBVIEW_MESSAGE_TYPES['app:exit'],
    payload,
  );
}

/**
 * Shortcut — báo game đã kết thúc.
 *
 * Payload tương thích với ClubGameResultDto (Kafka) — parent app
 * có thể map trực tiếp hoặc gửi tiếp lên Kafka.
 *
 * @param payload Thông tin kết quả game (phải khớp WebViewGameEndedPayload)
 */
export function notifyGameEnded(
  payload: WebViewGameEndedPayload,
): void {
  postWebViewMessage<WebViewGameEndedPayload>(
    WEBVIEW_MESSAGE_TYPES['game:ended'],
    payload,
  );
}

/**
 * Shortcut — báo game sẵn sàng.
 */
export function notifyAppReady(): void {
  postWebViewMessage(WEBVIEW_MESSAGE_TYPES['app:ready']);
}

// ============================================================
// Helper — tạo payload game:ended cho từng game
// ============================================================

/**
 * Tạo kafkaGameType từ gameType và subGame.
 * Ưu tiên subGame (nếu có), fallback về GAME_TYPE_TO_KAFKA.
 */
export function resolveKafkaGameType(
  gameType: GameType,
  subGame?: string,
): string {
  if (subGame && SUB_GAME_TO_KAFKA[subGame]) {
    return SUB_GAME_TO_KAFKA[subGame];
  }
  return GAME_TYPE_TO_KAFKA[gameType];
}