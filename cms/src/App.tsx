import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';

import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GomokuConfigPage, CardFlipConfigPage } from './pages/mind-game';
import { QuizArenaConfigPage, QuestionsPage } from './pages/quiz-arena';
import {
  BossBattleConfigPage,
  BossQuestionsPage,
  MonitorPage,
  WeeklyConfigPage,
} from './pages/boss-battle';
import {
  WeeklyEventGeneralSettingsPage,
  WeeklyEventListPage,
  WeeklyEventDetailPage,
  WeeklyEventExamBankPage,
  WeeklyEventMonitorPage,
} from './pages/weekly-event';
import { BotProfilesPage } from './pages/BotProfilesPage';

export function App() {
  return (
    <ConfigProvider locale={viVN}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            
            {/* Mind Game */}
            <Route path="mind-game">
              <Route path="gomoku" element={<GomokuConfigPage />} />
              <Route path="card-flip" element={<CardFlipConfigPage />} />
            </Route>
            
            {/* Quiz Arena */}
            <Route path="quiz-arena">
              <Route path="config" element={<QuizArenaConfigPage />} />
              <Route path="questions" element={<QuestionsPage />} />
            </Route>

            {/* Boss Battle (Săn Boss) */}
            <Route path="boss-battle">
              <Route path="config" element={<BossBattleConfigPage />} />
              <Route path="weekly-config" element={<WeeklyConfigPage />} />
              <Route path="questions" element={<BossQuestionsPage />} />
              <Route path="monitor" element={<MonitorPage />} />
            </Route>

            {/* Weekly Event (Sự kiện tuần) */}
            <Route path="weekly-event">
              <Route path="settings" element={<WeeklyEventGeneralSettingsPage />} />
              <Route path="events" element={<WeeklyEventListPage />} />
              <Route path="events/:id" element={<WeeklyEventDetailPage />} />
              <Route path="exams" element={<WeeklyEventExamBankPage />} />
              <Route path="monitor" element={<WeeklyEventMonitorPage />} />
            </Route>
            
            {/* Bot Profiles */}
            <Route path="bot-profiles" element={<BotProfilesPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
