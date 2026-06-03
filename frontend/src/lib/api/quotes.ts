const API = process.env.NEXT_PUBLIC_API_URL;

export interface LoginQuote {
  id: string;
  text_en: string;
  text_ar: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteSettings {
  id: string;
  rotation: 'weekly' | 'monthly';
  updated_at: string;
}

async function getAuthToken(): Promise<string> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getCurrentQuote(): Promise<LoginQuote | null> {
  const res = await fetch(`${API}/api/quotes/current`);
  const json = await res.json();
  if (!json.success) return null;
  return json.data;
}

export async function getAllQuotes(): Promise<LoginQuote[]> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function getQuoteSettings(): Promise<QuoteSettings> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes/settings`, {
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function createQuote(payload: {
  text_en: string;
  text_ar: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<LoginQuote> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function updateQuote(
  id: string,
  payload: Partial<Pick<LoginQuote, 'text_en' | 'text_ar' | 'sort_order' | 'is_active'>>
): Promise<LoginQuote> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function deleteQuote(id: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

export async function reorderQuotes(orderedIds: string[]): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

export async function updateQuoteSettings(rotation: 'weekly' | 'monthly'): Promise<QuoteSettings> {
  const token = await getAuthToken();
  const res = await fetch(`${API}/api/quotes/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ rotation }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
