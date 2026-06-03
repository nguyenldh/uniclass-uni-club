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
  overlayState: 'win' | 'lose' | 'draw' | 'idle';
  overlayStats: Array<{ label: string; value: string }>;

  setSession: (session: GomokuSession) => void;
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
  overlayState: 'idle',
  overlayStats: [],

  setSession: (session) => {
    const board = session.board.map(row => [...row]) as CellValue[][];
    // Tính timeElapsed từ startedAt để không bị reset về 0 sau F5
    const elapsed = session.startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))
      : 0;
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

  setWin: (win) => set({ win, status: 'finished' }),

  tick: () => set(s => ({ timeElapsed: s.timeElapsed + 1 })),

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
  overlayState: 'win' | 'lose' | 'draw' | 'idle';
  overlayStats: Array<{ label: string; value: string }>;

  setSession: (session: CardFlipSession) => void;
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
  overlayState: 'idle',
  overlayStats: [],

  setSession: (session) => {
    const cards: Array<MemoryCardData & { state: MemoryCardState }> = session.cards.map((c) => ({
      id: String(c.id),
      pairId: String(c.pairId),
      content: c.value,
      type: c.type === 'image' ? ('image' as const) : ('text' as const),
      state: c.matched ? 'matched' : c.flipped ? 'revealed' : 'hidden',
    }));

    const elapsed = session.startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))
      : 0;

    set({
      session,
      cards,
      currentTurn: session.currentTurn,
      scores: session.scores,
      lastFlipped: session.lastFlipped,
      timeElapsed: elapsed,
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

  tick: () => set((s) => ({ timeElapsed: s.timeElapsed + 1 })),

  endGame: (result, timeElapsed, myScore, opponentScore) => {
    const { session } = get();
    set({
      session: session ? { ...session, status: 'finished' as const } : null,
      overlayState: result,
      overlayStats: [
        { label: 'Thời gian', value: `${timeElapsed}s` },
        { label: 'Điểm bạn', value: String(myScore) },
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
    overlayState: 'idle',
    overlayStats: [],
  }),
}));
