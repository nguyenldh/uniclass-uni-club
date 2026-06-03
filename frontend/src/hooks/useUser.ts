// ============================================================
// useUser — lấy thông tin người dùng hiện tại
// ============================================================

import { useState, useEffect } from 'react';
import type { AuthUser } from '@uniclub/shared';
import { authApi, getStoredUser, setStoredUser, setStoredToken, getStoredToken } from '../services/auth';

export type { AuthUser as UserInfo };

/**
 * Hook lấy thông tin user.
 * 1. Kiểm tra sessionStorage trước (cache).
 * 2. Nếu không có, lấy token từ URL params (UniClass WebView).
 * 3. Gọi GET /api/auth/me với token để xác thực.
 * 4. Lưu kết quả vào sessionStorage.
 *
 * Nếu token mới (từ URL) khác với token đã lưu, hook sẽ gọi lại API
 * để cập nhật thông tin user thay vì dùng cache cũ.
 */
export function useUser(): { user: AuthUser | null; loading: boolean; error: string | null } {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Lấy token từ URL params (UniClass WebView truyền vào)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    // Lấy token cũ TRƯỚC khi ghi đè, để phát hiện token thay đổi
    const previousToken = getStoredToken();

    // Token thực tế dùng để gọi API: ưu tiên token từ URL
    const activeToken = urlToken || previousToken;

    // Kiểm tra xem token mới có khác với token đã lưu không
    const tokenChanged = !!urlToken && urlToken !== previousToken;

    // Luôn lưu token nếu có trong URL
    if (urlToken) {
      setStoredToken(urlToken);
    }

    // Nếu đã có user cache VÀ token không đổi → dùng cache
    const cached = getStoredUser();
    if (cached && !tokenChanged) {
      setUser(cached);
      setLoading(false);
      return;
    }

    if (!activeToken) {
      setError('Không tìm thấy token xác thực');
      setLoading(false);
      return;
    }

    // Gọi API /me để xác thực token và lấy thông tin user
    authApi
      .getMe(activeToken)
      .then((data) => {
        setStoredUser(data.user);
        setUser(data.user);
      })
      .catch((err: any) => {
        setError(err.message || 'Không thể lấy thông tin người dùng');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { user, loading, error };
}

