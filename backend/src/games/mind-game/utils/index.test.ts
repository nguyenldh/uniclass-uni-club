// ============================================================
// Unit Tests — Mind Game Utils (Gomoku board helpers)
// ============================================================

import { describe, it, expect } from 'vitest';
import { createEmptyBoard, checkGomokuWin, isBoardFull } from './index';
import type { Board } from '@uniclub/shared';

describe('createEmptyBoard', () => {
  it('tạo bàn cờ 15x15 mặc định', () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(15);
    expect(board[0].length).toBe(15);
    board.forEach((row) => row.forEach((cell) => expect(cell).toBeNull()));
  });

  it('tạo bàn cờ với kích thước tùy chỉnh', () => {
    const board = createEmptyBoard(9);
    expect(board.length).toBe(9);
    expect(board[0].length).toBe(9);
  });
});

describe('checkGomokuWin', () => {
  function makeBoard(size: number, moves: { row: number; col: number; symbol: 'X' | 'O' }[]): Board {
    const board = createEmptyBoard(size);
    for (const { row, col, symbol } of moves) {
      board[row][col] = symbol;
    }
    return board;
  }

  it('phát hiện thắng ngang 5 quân', () => {
    const board = makeBoard(15, [
      { row: 7, col: 3, symbol: 'X' },
      { row: 7, col: 4, symbol: 'X' },
      { row: 7, col: 5, symbol: 'X' },
      { row: 7, col: 6, symbol: 'X' },
      { row: 7, col: 7, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 7, 5, 'X')).toBe(true);
  });

  it('phát hiện thắng dọc 5 quân', () => {
    const board = makeBoard(15, [
      { row: 2, col: 10, symbol: 'O' },
      { row: 3, col: 10, symbol: 'O' },
      { row: 4, col: 10, symbol: 'O' },
      { row: 5, col: 10, symbol: 'O' },
      { row: 6, col: 10, symbol: 'O' },
    ]);
    expect(checkGomokuWin(board, 4, 10, 'O')).toBe(true);
  });

  it('phát hiện thắng chéo chính 5 quân', () => {
    const board = makeBoard(15, [
      { row: 0, col: 0, symbol: 'X' },
      { row: 1, col: 1, symbol: 'X' },
      { row: 2, col: 2, symbol: 'X' },
      { row: 3, col: 3, symbol: 'X' },
      { row: 4, col: 4, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 2, 2, 'X')).toBe(true);
  });

  it('phát hiện thắng chéo phụ 5 quân', () => {
    const board = makeBoard(15, [
      { row: 0, col: 10, symbol: 'O' },
      { row: 1, col: 9, symbol: 'O' },
      { row: 2, col: 8, symbol: 'O' },
      { row: 3, col: 7, symbol: 'O' },
      { row: 4, col: 6, symbol: 'O' },
    ]);
    expect(checkGomokuWin(board, 2, 8, 'O')).toBe(true);
  });

  it('không thắng khi chỉ có 4 quân liên tiếp', () => {
    const board = makeBoard(15, [
      { row: 7, col: 3, symbol: 'X' },
      { row: 7, col: 4, symbol: 'X' },
      { row: 7, col: 5, symbol: 'X' },
      { row: 7, col: 6, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 7, 4, 'X')).toBe(false);
  });

  it('không thắng khi 5 quân bị ngắt quãng', () => {
    const board = makeBoard(15, [
      { row: 7, col: 3, symbol: 'X' },
      { row: 7, col: 4, symbol: 'X' },
      { row: 7, col: 5, symbol: 'X' },
      { row: 7, col: 6, symbol: 'O' },
      { row: 7, col: 7, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 7, 4, 'X')).toBe(false);
  });

  it('phát hiện thắng >5 quân (6 quân liên tiếp)', () => {
    const board = makeBoard(15, [
      { row: 7, col: 2, symbol: 'X' },
      { row: 7, col: 3, symbol: 'X' },
      { row: 7, col: 4, symbol: 'X' },
      { row: 7, col: 5, symbol: 'X' },
      { row: 7, col: 6, symbol: 'X' },
      { row: 7, col: 7, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 7, 4, 'X')).toBe(true);
  });

  it('phát hiện thắng ở biên bàn cờ', () => {
    const board = makeBoard(15, [
      { row: 0, col: 0, symbol: 'X' },
      { row: 0, col: 1, symbol: 'X' },
      { row: 0, col: 2, symbol: 'X' },
      { row: 0, col: 3, symbol: 'X' },
      { row: 0, col: 4, symbol: 'X' },
    ]);
    expect(checkGomokuWin(board, 0, 2, 'X')).toBe(true);
  });

  it('không nhầm symbol khác', () => {
    const board = makeBoard(15, [
      { row: 7, col: 3, symbol: 'O' },
      { row: 7, col: 4, symbol: 'O' },
      { row: 7, col: 5, symbol: 'O' },
      { row: 7, col: 6, symbol: 'O' },
      { row: 7, col: 7, symbol: 'O' },
    ]);
    expect(checkGomokuWin(board, 7, 5, 'X')).toBe(false);
  });
});

describe('isBoardFull', () => {
  it('bàn cờ trống → false', () => {
    const board = createEmptyBoard(3);
    expect(isBoardFull(board)).toBe(false);
  });

  it('bàn cờ đầy → true', () => {
    const board: Board = [
      ['X', 'O', 'X'],
      ['O', 'X', 'O'],
      ['O', 'X', 'O'],
    ];
    expect(isBoardFull(board)).toBe(true);
  });

  it('bàn cờ còn ô trống → false', () => {
    const board: Board = [
      ['X', 'O', 'X'],
      ['O', null, 'O'],
      ['O', 'X', 'O'],
    ];
    expect(isBoardFull(board)).toBe(false);
  });
});
