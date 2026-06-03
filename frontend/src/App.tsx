import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { MindGameLobby, MatchmakingPage, GomokuPage, CardFlipPage } from './pages/mind-game';
import { QuizArenaLobbyPage, QuizArenaGamePage } from './pages/quiz-arena';
import { BossLobbyPage, BossBattlePage, BossResultPage, BossLeaderboardPage, BossHonorPage } from './pages/boss-battle';
import { ErrorPage } from './pages/ErrorPage';
import { BossBattleSocketProvider } from './hooks/useBossBattleSocketProvider';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Matchmaking — game-agnostic, dùng chung cho mọi game PvP */}
        <Route path="/matchmaking/:gameType" element={<MatchmakingPage />} />

        {/* Mind Game — Đấu trí */}
        <Route path="/mind-game" element={<MindGameLobby />} />
        <Route path="/mind-game/gomoku" element={<GomokuPage />} />
        <Route path="/mind-game/card-flip" element={<CardFlipPage />} />

        {/* So Tài — Quiz Arena */}
        <Route path="/quiz-arena" element={<QuizArenaLobbyPage />} />
        <Route path="/quiz-arena/game" element={<QuizArenaGamePage />} />

        {/* Săn Boss — Boss Battle (socket provider giữ kết nối xuyên suốt) */}
        <Route path="/boss-battle" element={<BossBattleSocketProvider><Outlet /></BossBattleSocketProvider>}>
          <Route index element={<BossLobbyPage />} />
          <Route path="battle" element={<BossBattlePage />} />
          <Route path="result" element={<BossResultPage />} />
          <Route path="leaderboard" element={<BossLeaderboardPage />} />
          <Route path="honor" element={<BossHonorPage />} />
        </Route>

        {/* Error */}
        <Route path="/error" element={<ErrorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
