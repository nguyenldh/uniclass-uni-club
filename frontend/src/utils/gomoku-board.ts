// ============================================================
// Gomoku Board Utils — port từ backend, thuần TypeScript
// ============================================================

import type { CellValue } from '@uniclub/shared';
import { GOMOKU_BOARD_SIZE, GOMOKU_WIN_STREAK } from '@uniclub/shared';

export type Board = CellValue[][];

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
  return getGomokuWinLine(board, row, col, symbol, winStreak) !== null;
}

/** Kết quả đường thắng */
export interface GomokuWinLine {
  from: [number, number];
  to: [number, number];
  cells: [number, number][];
}

/**
 * Lấy đường thắng Gomoku nếu có.
 * Trả về null nếu không thắng, ngược lại trả về toạ độ from, to và danh sách các ô thuộc đường thắng.
 */
export function getGomokuWinLine(
  board: Board,
  row: number,
  col: number,
  symbol: 'X' | 'O',
  winStreak: number = GOMOKU_WIN_STREAK,
): GomokuWinLine | null {
  const directions: [number, number][] = [
    [0, 1],  // ngang
    [1, 0],  // dọc
    [1, 1],  // chéo chính
    [1, -1], // chéo phụ
  ];

  for (const [dr, dc] of directions) {
    const cells: [number, number][] = [[row, col]];

    // Đi về phía dương
    for (let i = 1; i < winStreak; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === symbol) {
        cells.push([r, c]);
      } else break;
    }

    // Đi về phía âm
    for (let i = 1; i < winStreak; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === symbol) {
        cells.unshift([r, c]);
      } else break;
    }

    if (cells.length >= winStreak) {
      return {
        from: cells[0],
        to: cells[cells.length - 1],
        cells,
      };
    }
  }

  return null;
}

/** Kiểm tra bàn cờ đã đầy chưa (hòa) */
export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}
