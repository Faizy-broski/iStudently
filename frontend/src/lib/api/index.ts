import { getAuthToken } from "./schools";
import { simpleFetch } from "./abortable-fetch";
import { handleSessionExpiry } from "@/context/AuthContext";
import { API_URL } from "@/config/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: "Authentication required" };

  const impersonatedSchoolId =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('impersonatedSchoolId')
      : null

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(impersonatedSchoolId ? { "X-School-Id": impersonatedSchoolId } : {}),
        ...(options.headers as Record<string, string> | undefined),
      },
      timeout: 30000,
    });

    if (response.status === 401) {
      await handleSessionExpiry();
      return { success: false, error: "Session expired" };
    }

    // Handle 403 — dispatch 2FA events so AuthContext can redirect immediately
    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.code === 'TWO_FA_SETUP_REQUIRED') {
        window.dispatchEvent(new CustomEvent('studently:two_fa_setup_required'));
        return { success: false, error: '__2FA_SETUP_REQUIRED__', code: 'TWO_FA_SETUP_REQUIRED' } as any;
      }
      if (data.code === 'TWO_FA_REQUIRED') {
        window.dispatchEvent(new CustomEvent('studently:two_fa_required'));
        return { success: false, error: '__2FA_REQUIRED__', code: 'TWO_FA_REQUIRED' } as any;
      }
      return { success: false, error: data?.error || 'Permission denied' };
    }

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data?.error || "Request failed" };
    }

    return data;
  } catch {
    return { success: false, error: "Network error" };
  }
}
