// ============================================================
// Mind Game Services — barrel export
// ============================================================

export { GomokuService } from './gomoku.service';
export { CardFlipService } from './card-flip.service';

// Đăng ký Gomoku vào MatchmakingService (game-agnostic)
export { registerGomokuMatchmaking } from './gomoku-matchmaking.factory';

// Đăng ký Card Flip vào MatchmakingService (game-agnostic)
export { registerCardFlipMatchmaking } from './card-flip-matchmaking.factory';
