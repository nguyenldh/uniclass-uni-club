import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { MindGameLobby, MatchmakingPage, GomokuPage, CardFlipPage } from './pages/mind-game';
import { QuizArenaLobbyPage, QuizArenaGamePage, InviteRoomPage } from './pages/quiz-arena';
import { BossLobbyPage, BossBattlePage, BossResultPage, BossLeaderboardPage, BossHonorPage } from './pages/boss-battle';
import { ErrorPage } from './pages/ErrorPage';
import { BossBattleSocketProvider } from './hooks/useBossBattleSocketProvider';
import { WeeklyEventController } from './pages/weekly-event';
import { WeeklyEventPanel, WeeklyEventPanelLayout } from './components';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Weekly Event — Sự kiện tuần (không gắn panel cho chính trang này) */}
        <Route path="/weekly-event" element={<WeeklyEventController />} />

        {/* Đấu trí + Matchmaking — dùng chung layout gắn WeeklyEventPanel */}
        <Route element={<WeeklyEventPanelLayout />}>
          {/* Matchmaking — game-agnostic, dùng chung cho mọi game PvP */}
          <Route path="/matchmaking/:gameType" element={<MatchmakingPage />} />
          {/* Mind Game — Đấu trí */}
          {/* <Route path="/mind-game" element={<MindGameLobby />} /> */}
          <Route path="/mind-game/gomoku" element={<GomokuPage />} />
          <Route path="/mind-game/card_flip" element={<CardFlipPage />} />
        </Route>

        {/* So Tài — Quiz Arena (layout gắn WeeklyEventPanel cho mọi màn) */}
        <Route path="/quiz-arena" element={<WeeklyEventPanelLayout />}>
          <Route index element={<QuizArenaLobbyPage />} />
          <Route path="game" element={<QuizArenaGamePage />} />
          {/* Phòng mời bạn — host (không param) & guest (kèm roomId) */}
          <Route path="room" element={<InviteRoomPage />} />
          <Route path="room/:roomId" element={<InviteRoomPage />} />
        </Route>

        {/* Săn Boss — Boss Battle (socket provider giữ kết nối xuyên suốt) */}
        <Route
          path="/boss-battle"
          element={
            <BossBattleSocketProvider>
              <WeeklyEventPanel />
              <Outlet />
            </BossBattleSocketProvider>
          }
        >
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
