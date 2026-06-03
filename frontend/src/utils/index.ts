// Utility helpers
export { postWebViewMessage, exitWebView, notifyGameEnded, notifyAppReady, resolveKafkaGameType } from './webview';
export { createEmptyBoard, checkGomokuWin, getGomokuWinLine, isBoardFull } from './gomoku-board';
export type { Board, GomokuWinLine } from './gomoku-board';
export { GomokuAI } from './gomoku-ai';
export { CardFlipAI } from './card-flip-ai';

/**
 * Lấy chữ cái đầu từ tên đầy đủ.
 * Ví dụ: "Duy Hoàng" → "DH", "Nguyễn Văn An" → "NA"
 * Tối đa 2 ký tự (từ đầu và từ cuối).
 */
export function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  // Lấy chữ cái đầu của từ đầu và từ cuối
  const first = words[0].charAt(0).toUpperCase();
  const last = words[words.length - 1].charAt(0).toUpperCase();
  return first + last;
}
