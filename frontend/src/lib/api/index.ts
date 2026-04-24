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

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
      timeout: 30000,
    });

    const data = await response.json();
    if (response.status === 401) {
      await handleSessionExpiry();
      return { success: false, error: "Session expired" };
    }

    if (!response.ok) {
      return { success: false, error: data?.error || "Request failed" };
    }

    return data;
  } catch {
    return { success: false, error: "Network error" };
  }
}
