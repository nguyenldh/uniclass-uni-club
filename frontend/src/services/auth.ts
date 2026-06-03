import type { AuthUser } from '@uniclub/shared';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth`;

const SESSION_KEY = 'uniclub_user';
const TOKEN_KEY = 'uniclub_token';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const authApi = {
  /**
   * Gọi GET /api/auth/me với token trong Authorization header.
   * Trả về thông tin người dùng từ JWT.
   */
  getMe: (token: string) =>
    request<{ success: boolean; user: AuthUser }>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ---- Session Storage helpers ----

export function getStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ---- Token helpers ----

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// ---- Shared API request helper (auto-attach Bearer token) ----

/**
 * Gọi API với Bearer token tự động từ sessionStorage.
 * Dùng chung cho tất cả service (boss-battle, mind-game, quiz-arena, ...).
 */
export async function apiRequest<T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const defaultHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Merge: defaultHeaders làm base, options.headers override nếu có
  const { headers: optHeaders, ...restOpts } = options ?? {};

  const res = await fetch(`${baseUrl}${path}`, {
    ...restOpts,
    headers: {
      ...defaultHeaders,
      ...(optHeaders as Record<string, string> | undefined),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
