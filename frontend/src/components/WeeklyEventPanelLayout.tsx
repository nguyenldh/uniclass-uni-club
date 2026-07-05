// ============================================================
// WeeklyEventPanelLayout — layout route dùng chung, gắn WeeklyEventPanel
// một lần cho mọi màn con (Outlet). Panel giữ nguyên khi chuyển giữa các
// màn cùng nhánh (không remount → đồng hồ chạy liền mạch).
//
// Dùng cho So Tài, Đấu trí (+ matchmaking). Săn boss dùng panel trực tiếp
// trong provider socket sẵn có.
// ============================================================

import { Outlet } from 'react-router-dom';
import { WeeklyEventPanel } from './WeeklyEventPanel';

export function WeeklyEventPanelLayout() {
  return (
    <>
      <WeeklyEventPanel />
      <Outlet />
    </>
  );
}
