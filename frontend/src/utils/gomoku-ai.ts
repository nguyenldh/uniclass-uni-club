// ============================================================
// Gomoku AI Service — engine cải tiến:
//   • Pattern-based evaluation (nhận diện open/closed four, three, broken patterns)
//   • Threat detection (immediate win, force-four)
//   • Minimax 4-ply với alpha-beta + move ordering
// ============================================================

import type { AIDifficulty } from '@uniclub/shared';
import { GOMOKU_BOARD_SIZE, GOMOKU_WIN_STREAK } from '@uniclub/shared';
import { checkGomokuWin, type Board } from './gomoku-board';

interface Move {
  row: number;
  col: number;
}

interface ScoredMove extends Move {
  score: number;
}

// ─── Pattern scoring ────────────────────────────────────────────────────────
// Mã hóa line: '1' = mình, '2' = đối thủ / tường, '0' = ô trống.
// Tường (out-of-bounds) cũng được encode = '2' để pattern bám biên (vd "tứ
// dính tường") cũng được nhận đúng là tứ-bị-chặn.

const SCORE_FIVE       = 10_000_000;
const SCORE_OPEN_FOUR  =  1_000_000;
const SCORE_FOUR       =    100_000;
const SCORE_OPEN_THREE =     10_000;
const SCORE_THREE      =      1_000;
const SCORE_OPEN_TWO   =        200;
const SCORE_TWO        =         50;

// Patterns match từ mạnh → yếu. Sau mỗi lần match thành công, thay phần đã
// match thành '_' để pattern khác không đếm lại (tránh inflate).
const PATTERN_TABLE: Array<{ re: RegExp; score: number }> = [
  // Ngũ tử — đã thắng
  { re: /11111/g, score: SCORE_FIVE },

  // Tứ thoáng (open four) — chắc thắng, không thể chặn bằng 1 nước
  { re: /011110/g, score: SCORE_OPEN_FOUR },

  // Tứ gãy (broken four) & tứ bị chặn — buộc đối thủ phải chặn
  { re: /11011|10111|11101/g, score: SCORE_FOUR },
  { re: /211110|011112/g, score: SCORE_FOUR },
  { re: /11110|01111/g, score: SCORE_FOUR * 0.8 },

  // Tam thoáng (open three) — có thể tiến hóa thành open four
  { re: /011100|001110|010110|011010/g, score: SCORE_OPEN_THREE },

  // Tam bị chặn
  { re: /211100|001112/g, score: SCORE_THREE },
  { re: /11100|00111|11010|01011|10110|01101|10011|11001/g, score: SCORE_THREE * 0.6 },

  // Nhị thoáng
  { re: /011000|000110|001100|010100|001010|010010/g, score: SCORE_OPEN_TWO },

  // Nhị bị chặn
  { re: /11000|00011|10100|00101|10010|01001/g, score: SCORE_TWO },
];

function scoreLine(line: string): number {
  let working = line;
  let total = 0;
  for (const { re, score } of PATTERN_TABLE) {
    const matches = working.match(re);
    if (!matches) continue;
    total += matches.length * score;
    working = working.replace(re, (m) => '_'.repeat(m.length));
  }
  return total;
}

// ─── Line extraction helpers ────────────────────────────────────────────────

const DIRECTIONS: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
const LINE_RADIUS = 5; // đủ để chứa mọi pattern 6 ký tự ở 2 phía

function encodeCell(cell: 'X' | 'O' | null, self: 'X' | 'O'): string {
  if (cell === null) return '0';
  return cell === self ? '1' : '2';
}

/** Trích chuỗi 2 × LINE_RADIUS + 1 ô đi qua (row, col) theo hướng (dr, dc). */
function extractLineThrough(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  self: 'X' | 'O',
): string {
  const size = board.length;
  let s = '';
  for (let i = -LINE_RADIUS; i <= LINE_RADIUS; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) {
      s += '2'; // tường ≡ đối thủ chặn
    } else {
      s += encodeCell(board[r][c], self);
    }
  }
  return s;
}

/** Tổng điểm theo 4 hướng xuyên qua (row, col) — dùng cho move ordering. */
function scoreThroughPoint(
  board: Board,
  row: number,
  col: number,
  self: 'X' | 'O',
): number {
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    total += scoreLine(extractLineThrough(board, row, col, dr, dc, self));
  }
  return total;
}

/** Đánh giá toàn board cho `self`. Positive = self đang ưu thế. */
function evaluateBoard(
  board: Board,
  self: 'X' | 'O',
  opp: 'X' | 'O',
): number {
  const size = board.length;

  const collectLines = (sym: 'X' | 'O'): string[] => {
    const lines: string[] = [];

    // Hàng
    for (let r = 0; r < size; r++) {
      let s = '';
      for (let c = 0; c < size; c++) s += encodeCell(board[r][c], sym);
      lines.push(s);
    }
    // Cột
    for (let c = 0; c < size; c++) {
      let s = '';
      for (let r = 0; r < size; r++) s += encodeCell(board[r][c], sym);
      lines.push(s);
    }
    // Chéo \ : r - c = const
    for (let k = -(size - 1); k <= size - 1; k++) {
      let s = '';
      const rStart = Math.max(0, k);
      const rEnd = Math.min(size - 1, size - 1 + k);
      for (let r = rStart; r <= rEnd; r++) s += encodeCell(board[r][r - k], sym);
      if (s.length >= GOMOKU_WIN_STREAK) lines.push(s);
    }
    // Chéo / : r + c = const
    for (let k = 0; k <= 2 * (size - 1); k++) {
      let s = '';
      const rStart = Math.max(0, k - (size - 1));
      const rEnd = Math.min(size - 1, k);
      for (let r = rStart; r <= rEnd; r++) s += encodeCell(board[r][k - r], sym);
      if (s.length >= GOMOKU_WIN_STREAK) lines.push(s);
    }
    return lines;
  };

  let selfTotal = 0;
  let oppTotal = 0;
  for (const line of collectLines(self)) selfTotal += scoreLine(line);
  for (const line of collectLines(opp)) oppTotal += scoreLine(line);

  // Hệ số 1.1 cho đối thủ → AI hơi thiên về phòng thủ.
  return selfTotal - oppTotal * 1.1;
}

// ─── AI engine ──────────────────────────────────────────────────────────────

export class GomokuAI {
  static getMove(
    board: Board,
    aiSymbol: 'X' | 'O',
    difficulty: AIDifficulty,
  ): Move | null {
    const emptyCells = this.getEmptyCells(board);
    if (emptyCells.length === 0) return null;

    switch (difficulty) {
      case 'easy':
        return this.easyMove(board, aiSymbol, emptyCells);
      case 'medium':
        return this.mediumMove(board, aiSymbol, emptyCells);
      case 'hard':
        return this.hardMove(board, aiSymbol, emptyCells);
      default:
        return this.mediumMove(board, aiSymbol, emptyCells);
    }
  }

  // ─── Easy: phần lớn random, 30% chặn nước thắng của đối thủ ──────────────
  private static easyMove(
    board: Board,
    aiSymbol: 'X' | 'O',
    emptyCells: Move[],
  ): Move {
    const opp = aiSymbol === 'X' ? 'O' : 'X';

    const win = this.findWinningMove(board, aiSymbol, emptyCells);
    if (win) return win;

    if (Math.random() < 0.3) {
      const block = this.findWinningMove(board, opp, emptyCells);
      if (block) return block;
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  // ─── Medium: pattern-eval + chọn ngẫu nhiên trong top 3 ──────────────────
  private static mediumMove(
    board: Board,
    aiSymbol: 'X' | 'O',
    emptyCells: Move[],
  ): Move {
    const opp = aiSymbol === 'X' ? 'O' : 'X';

    const win = this.findWinningMove(board, aiSymbol, emptyCells);
    if (win) return win;

    const block = this.findWinningMove(board, opp, emptyCells);
    if (block) return block;

    const candidates = this.getNearbyEmptyCells(board, emptyCells, 2);
    const scored: ScoredMove[] = candidates.map(({ row, col }) => ({
      row,
      col,
      score: this.evaluateMove(board, row, col, aiSymbol, opp),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topN = Math.min(3, scored.length);
    return scored[Math.floor(Math.random() * topN)];
  }

  // ─── Hard: threat ladder + minimax 4-ply ─────────────────────────────────
  private static hardMove(
    board: Board,
    aiSymbol: 'X' | 'O',
    emptyCells: Move[],
  ): Move {
    const opp = aiSymbol === 'X' ? 'O' : 'X';

    // Bàn còn trống → đánh trung tâm
    if (emptyCells.length === GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE) {
      const center = Math.floor(GOMOKU_BOARD_SIZE / 2);
      return { row: center, col: center };
    }

    // 1. Có nước thắng ngay → đánh
    const win = this.findWinningMove(board, aiSymbol, emptyCells);
    if (win) return win;

    // 2. Đối thủ có nước thắng → chặn
    const block = this.findWinningMove(board, opp, emptyCells);
    if (block) return block;

    // 3. Có nước tạo open four (1 nước nữa thắng) cho mình → đánh
    const myForceFour = this.findOpenFourMove(board, aiSymbol, emptyCells);
    if (myForceFour) return myForceFour;

    // 4. Đối thủ sắp tạo open four → chặn ngay
    const oppForceFour = this.findOpenFourMove(board, opp, emptyCells);
    if (oppForceFour) return oppForceFour;

    // 5. Minimax sâu trên top candidates đã sort
    const candidates = this.getOrderedCandidates(board, emptyCells, aiSymbol, opp, 12);
    let bestScore = -Infinity;
    let bestMove: Move = candidates[0];

    for (const { row, col } of candidates) {
      board[row][col] = aiSymbol;
      const score = this.minimax(board, 3, false, aiSymbol, opp, -Infinity, Infinity);
      board[row][col] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = { row, col };
      }
    }
    return bestMove;
  }

  // ─── Threat detection ────────────────────────────────────────────────────

  /** Tìm nước mà sau khi đặt sẽ tạo ra open four cho `sym`. */
  private static findOpenFourMove(
    board: Board,
    sym: 'X' | 'O',
    emptyCells: Move[],
  ): Move | null {
    for (const { row, col } of emptyCells) {
      board[row][col] = sym;
      const created = this.hasOpenFour(board, row, col, sym);
      board[row][col] = null;
      if (created) return { row, col };
    }
    return null;
  }

  private static hasOpenFour(
    board: Board,
    row: number,
    col: number,
    sym: 'X' | 'O',
  ): boolean {
    for (const [dr, dc] of DIRECTIONS) {
      const line = extractLineThrough(board, row, col, dr, dc, sym);
      if (/011110/.test(line)) return true;
    }
    return false;
  }

  private static findWinningMove(
    board: Board,
    sym: 'X' | 'O',
    emptyCells: Move[],
  ): Move | null {
    for (const { row, col } of emptyCells) {
      board[row][col] = sym;
      const wins = checkGomokuWin(board, row, col, sym);
      board[row][col] = null;
      if (wins) return { row, col };
    }
    return null;
  }

  // ─── Move evaluation ─────────────────────────────────────────────────────

  /**
   * Điểm cho 1 nước đi = công (mình đặt ở đây) + 0.9 × thủ (giả định đối thủ
   * đặt ở đây). Ô có giá trị thủ cao = vị trí đáng giành.
   */
  private static evaluateMove(
    board: Board,
    row: number,
    col: number,
    self: 'X' | 'O',
    opp: 'X' | 'O',
  ): number {
    board[row][col] = self;
    const attack = scoreThroughPoint(board, row, col, self);
    board[row][col] = null;

    board[row][col] = opp;
    const defense = scoreThroughPoint(board, row, col, opp);
    board[row][col] = null;

    return attack + defense * 0.9;
  }

  // ─── Candidate generation ────────────────────────────────────────────────

  private static getEmptyCells(board: Board): Move[] {
    const cells: Move[] = [];
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c] === null) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  /** Chỉ lấy ô trống có hàng xóm trong bán kính `radius`. */
  private static getNearbyEmptyCells(
    board: Board,
    emptyCells: Move[],
    radius = 2,
  ): Move[] {
    const hasNeighbor = (r: number, c: number): boolean => {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 && nr < board.length &&
            nc >= 0 && nc < board[0].length &&
            board[nr][nc] !== null
          ) return true;
        }
      }
      return false;
    };
    const nearby = emptyCells.filter(({ row, col }) => hasNeighbor(row, col));
    return nearby.length > 0 ? nearby : emptyCells.slice(0, 15);
  }

  /** Sắp xếp candidates giảm dần theo điểm heuristic, lấy top-N. */
  private static getOrderedCandidates(
    board: Board,
    emptyCells: Move[],
    self: 'X' | 'O',
    opp: 'X' | 'O',
    topN: number,
  ): Move[] {
    const nearby = this.getNearbyEmptyCells(board, emptyCells, 2);
    const scored: ScoredMove[] = nearby.map(({ row, col }) => ({
      row,
      col,
      score: this.evaluateMove(board, row, col, self, opp),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  // ─── Minimax with alpha-beta + move ordering ─────────────────────────────

  private static minimax(
    board: Board,
    depth: number,
    maximizing: boolean,
    aiSymbol: 'X' | 'O',
    opp: 'X' | 'O',
    alpha: number,
    beta: number,
  ): number {
    if (depth === 0) {
      return evaluateBoard(board, aiSymbol, opp);
    }

    const emptyCells = this.getEmptyCells(board);
    if (emptyCells.length === 0) return 0;

    const currentSym = maximizing ? aiSymbol : opp;
    const otherSym = maximizing ? opp : aiSymbol;
    const candidates = this.getOrderedCandidates(board, emptyCells, currentSym, otherSym, 8);

    if (maximizing) {
      let maxEval = -Infinity;
      for (const { row, col } of candidates) {
        board[row][col] = aiSymbol;
        if (checkGomokuWin(board, row, col, aiSymbol)) {
          board[row][col] = null;
          return SCORE_FIVE + depth; // thắng càng sớm điểm càng cao
        }
        const score = this.minimax(board, depth - 1, false, aiSymbol, opp, alpha, beta);
        board[row][col] = null;
        if (score > maxEval) maxEval = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const { row, col } of candidates) {
        board[row][col] = opp;
        if (checkGomokuWin(board, row, col, opp)) {
          board[row][col] = null;
          return -SCORE_FIVE - depth;
        }
        const score = this.minimax(board, depth - 1, true, aiSymbol, opp, alpha, beta);
        board[row][col] = null;
        if (score < minEval) minEval = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
}