// ============================================================
// Mind Game Utils — Gomoku board helpers
// ============================================================

import type { Board } from '@uniclub/shared';
import { GOMOKU_BOARD_SIZE, GOMOKU_WIN_STREAK } from '@uniclub/shared';

/** Tạo bàn cờ trống */
export function createEmptyBoard(size: number = GOMOKU_BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

/** Kiểm tra thắng Gomoku — kiểm tra 4 hướng */
export function checkGomokuWin(
  board: Board,
  row: number,
  col: number,
  symbol: 'X' | 'O',
  winStreak: number = GOMOKU_WIN_STREAK,
): boolean {
  const directions: [number, number][] = [
    [0, 1],  // ngang
    [1, 0],  // dọc
    [1, 1],  // chéo chính
    [1, -1], // chéo phụ
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    for (let i = 1; i < winStreak; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === symbol) {
        count++;
      } else break;
    }

    for (let i = 1; i < winStreak; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === symbol) {
        count++;
      } else break;
    }

    if (count >= winStreak) return true;
  }

  return false;
}

/** Kiểm tra bàn cờ đã đầy chưa (hòa) */
export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}
