import { create } from 'zustand';
import type {
  GomokuSession,
  CardFlipSession,
  Board,
  CellValue,
} from '@uniclub/shared';
import type { MemoryCardData, MemoryCardState, CaroCoord, CaroWinInfo } from '../design-system/games';

// ============================================================
// Gomoku Store
// ============================================================

interface GomokuState {
  session: GomokuSession | null;
  board: CellValue[][];
  currentTurn: 'X' | 'O';
  lastMove: CaroCoord | null;
  win: CaroWinInfo | null;
  winner: string | null;
  status: string;
  moveCount: number;
  timeElapsed: number;
  /** Lệch đồng hồ client↔server (ms) = serverNow - clientNow, đo 1 lần khi hydrate session */
  clockSkewMs: number;
  overlayState: 'win' | 'lose' | 'draw' | 'idle';
  overlayStats: Array<{ label: string; value: string }>;

  setSession: (session: GomokuSession, serverNow?: number) => void;
  makeMove: (row: number, col: number, symbol: 'X' | 'O') => void;
  setWin: (win: CaroWinInfo) => void;
  tick: () => void;
  endGame: (result: 'win' | 'lose', timeElapsed: number, moves: number, score: number) => void;
  reset: () => void;
}

const EMPTY_BOARD: CellValue[][] = Array.from({ length: 15 }, () =>
  Array(15).fill(null)
);

export const useGomokuStore = create<GomokuState>((set, get) => ({
  session: null,
  board: EMPTY_BOARD.map(row => [...row]),
  currentTurn: 'X',
  lastMove: null,
  win: null,
  winner: null,
  status: 'idle',
  moveCount: 0,
  timeElapsed: 0,
  clockSkewMs: 0,
  overlayState: 'idle',
  overlayStats: [],

  setSession: (session, serverNow) => {
    const board = session.board.map(row => [...row]) as CellValue[][];
    // Đo lệch đồng hồ 1 lần từ serverNow (giờ server lúc trả response). Sau đó mọi
    // tính toán dùng "giờ server ước lượng" = Date.now() + clockSkewMs, không phụ
    // thuộc đồng hồ tuyệt đối của thiết bị (tránh đếm lại từ đầu khi máy lệch giờ).
    const clockSkewMs = serverNow != null ? serverNow - Date.now() : 0;
    const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const elapsed = Math.max(0, Math.floor((Date.now() + clockSkewMs - startedAtMs) / 1000));
    set({
      session,
      board,
      currentTurn: session.currentTurn,
      lastMove: null,
      win: null,
      winner: session.winner ?? null,
      status: session.status,
      moveCount: session.moveCount,
      timeElapsed: elapsed,
      clockSkewMs,
      overlayState: 'idle',
      overlayStats: [],
    });
  },

  makeMove: (row, col, symbol) => {
    const { board, moveCount } = get();
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = symbol;
    set({
      board: newBoard,
      currentTurn: symbol === 'X' ? 'O' : 'X',
      lastMove: [row, col],
      moveCount: moveCount + 1,
    });
  },

  setWin: (win) => {
    const { session } = get();
    set({
      win,
      status: 'finished',
      session: session ? { ...session, status: 'finished' as const } : null,
    });
  },

  // Tính lại từ startedAt (hiệu chỉnh skew), KHÔNG cộng dồn → miễn nhiễm throttle khi nền
  // và lệch đồng hồ thiết bị.
  tick: () => set(s => {
    if (!s.session?.startedAt) return {};
    const startedAtMs = new Date(s.session.startedAt).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() + s.clockSkewMs - startedAtMs) / 1000));
    return { timeElapsed: elapsed };
  }),

  endGame: (result, timeElapsed, moves, score) => {
    const { session } = get();
    set({
      session: session ? { ...session, status: 'finished' as const } : null,
      status: 'finished',
      overlayState: result,
      overlayStats: [
        { label: 'Thời gian', value: `${timeElapsed}s` },
        { label: 'Số nước', value: String(moves) },
        { label: 'Điểm', value: `+${score}` },
      ],
    });
  },

  reset: () => set({
    session: null,
    board: EMPTY_BOARD.map(row => [...row]),
    currentTurn: 'X',
    lastMove: null,
    win: null,
    winner: null,
    status: 'idle',
    moveCount: 0,
    timeElapsed: 0,
    clockSkewMs: 0,
    overlayState: 'idle',
    overlayStats: [],
  }),
}));

// ============================================================
// Card Flip Store
// ============================================================

interface CardFlipState {
  session: CardFlipSession | null;
  cards: Array<MemoryCardData & { state: MemoryCardState }>;
  currentTurn: string;
  scores: { playerA: number; playerB: number };
  lastFlipped: number[];
  timeElapsed: number;
  /** Lệch đồng hồ client↔server (ms) = serverNow - clientNow, đo 1 lần khi hydrate session */
  clockSkewMs: number;
  overlayState: 'win' | 'lose' | 'draw' | 'idle';
  overlayStats: Array<{ label: string; value: string }>;

  setSession: (session: CardFlipSession, serverNow?: number) => void;
  syncFromServer: (data: { cards: Array<{ id: number; pairId: number; value: string; flipped: boolean; matched: boolean }>; currentTurn: string; scores: { playerA: number; playerB: number }; lastFlipped: number[] }) => void;
  flipCard: (cardId: number) => void;
  markMatched: (cardId1: number, cardId2: number) => void;
  resetFlipped: () => void;
  switchTurn: (newTurn: string) => void;
  tick: () => void;
  endGame: (result: 'win' | 'lose' | 'draw', timeElapsed: number, myScore: number, opponentScore: number) => void;
  reset: () => void;
}

export const useCardFlipStore = create<CardFlipState>((set, get) => ({
  session: null,
  cards: [],
  currentTurn: '',
  scores: { playerA: 0, playerB: 0 },
  lastFlipped: [],
  timeElapsed: 0,
  clockSkewMs: 0,
  overlayState: 'idle',
  overlayStats: [],

  setSession: (session, serverNow) => {
    const cards: Array<MemoryCardData & { state: MemoryCardState }> = session.cards.map((c) => ({
      id: String(c.id),
      pairId: String(c.pairId),
      content: c.value,
      type: c.type === 'image' ? ('image' as const) : ('text' as const),
      state: c.matched ? 'matched' : c.flipped ? 'revealed' : 'hidden',
    }));

    // Đo lệch đồng hồ 1 lần từ serverNow; dùng "giờ server ước lượng" = Date.now() + skew.
    const clockSkewMs = serverNow != null ? serverNow - Date.now() : 0;
    const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const elapsed = Math.max(0, Math.floor((Date.now() + clockSkewMs - startedAtMs) / 1000));

    set({
      session,
      cards,
      currentTurn: session.currentTurn,
      scores: session.scores,
      lastFlipped: session.lastFlipped,
      timeElapsed: elapsed,
      clockSkewMs,
      overlayState: 'idle',
      overlayStats: [],
    });
  },

  /** Đồng bộ toàn bộ state từ server (dùng cho socket broadcast) */
  syncFromServer: (data: { cards: Array<{ id: number; pairId: number; value: string; type?: 'emoji' | 'image'; flipped: boolean; matched: boolean }>; currentTurn: string; scores: { playerA: number; playerB: number }; lastFlipped: number[] }) => {
    const cards: Array<MemoryCardData & { state: MemoryCardState }> = data.cards.map((c) => ({
      id: String(c.id),
      pairId: String(c.pairId),
      content: c.value,
      type: c.type === 'image' ? ('image' as const) : ('text' as const),
      state: c.matched ? 'matched' : c.flipped ? 'revealed' : 'hidden',
    }));
    set({ cards, currentTurn: data.currentTurn, scores: data.scores, lastFlipped: data.lastFlipped });
  },

  flipCard: (cardId) => {
    const { cards, lastFlipped } = get();
    const newCards = cards.map((c) =>
      c.id === String(cardId) ? { ...c, state: 'revealed' as MemoryCardState } : c,
    );
    set({ cards: newCards, lastFlipped: [...lastFlipped, cardId] });
  },

  markMatched: (cardId1, cardId2) => {
    const { cards } = get();
    const newCards = cards.map((c) =>
      c.id === String(cardId1) || c.id === String(cardId2)
        ? { ...c, state: 'matched' as MemoryCardState }
        : c,
    );
    set({ cards: newCards, lastFlipped: [] });
  },

  resetFlipped: () => {
    const { cards } = get();
    const newCards = cards.map((c) =>
      c.state === 'revealed' ? { ...c, state: 'hidden' as MemoryCardState } : c,
    );
    set({ cards: newCards, lastFlipped: [] });
  },

  switchTurn: (newTurn) => set({ currentTurn: newTurn }),

  // Tính lại từ startedAt (hiệu chỉnh skew), KHÔNG cộng dồn → miễn nhiễm throttle khi nền
  // và lệch đồng hồ thiết bị.
  tick: () => set((s) => {
    if (!s.session?.startedAt) return {};
    const startedAtMs = new Date(s.session.startedAt).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() + s.clockSkewMs - startedAtMs) / 1000));
    return { timeElapsed: elapsed };
  }),

  endGame: (result, timeElapsed, myScore, opponentScore) => {
    const { session } = get();
    set({
      session: session ? { ...session, status: 'finished' as const } : null,
      overlayState: result,
      overlayStats: [
        { label: 'Thời gian', value: `${timeElapsed}s` },
        { label: 'Điểm của bạn', value: String(myScore) },
        { label: 'Điểm đối thủ', value: String(opponentScore) },
      ],
    });
  },

  reset: () => set({
    session: null,
    cards: [],
    currentTurn: '',
    scores: { playerA: 0, playerB: 0 },
    lastFlipped: [],
    timeElapsed: 0,
    clockSkewMs: 0,
    overlayState: 'idle',
    overlayStats: [],
  }),
}));
