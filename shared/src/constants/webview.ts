// ============================================================
// WebView Message Constants — hằng số dùng chung cho postMessage
// ============================================================

import type { WebViewMessageType } from '../types/webview';
import type { KafkaGameType } from '../types/kafka-events';

/**
 * Các loại message WebView — single source of truth.
 * Frontend bắn message, parent app (UniClass) lắng nghe và xử lý.
 */
export const WEBVIEW_MESSAGE_TYPES: Record<WebViewMessageType, WebViewMessageType> = {
  'app:exit': 'app:exit',
  'app:ready': 'app:ready',
  'game:started': 'game:started',
  'game:ended': 'game:ended',
  'game:score': 'game:score',
  'game:error': 'game:error',
  'mgm:invite': 'mgm:invite',
  'mgm:guest-reward': 'mgm:guest-reward',
  'mgm:user-reward': 'mgm:user-reward',
} as const;

/** Phiên bản hiện tại của WebView message format */
export const WEBVIEW_MESSAGE_VERSION = 1;

/**
 * Map sub-game → Kafka game type.
 * Dùng khi gửi game:ended cho mind_game sub-games.
 */
export const SUB_GAME_TO_KAFKA: Record<string, KafkaGameType> = {
  gomoku: 'CARO',
  card_flip: 'LAT_MANH_GHEP',
};