import { supabase } from '../config/supabase';

export const getAllQuotes = async () => {
  const { data, error } = await supabase
    .from('login_quotes')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

export const getActiveQuotes = async () => {
  const { data, error } = await supabase
    .from('login_quotes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

export const getQuoteSettings = async () => {
  const { data, error } = await supabase
    .from('login_quote_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getCurrentQuote = async () => {
  const quotes = await getActiveQuotes();
  if (!quotes || quotes.length === 0) return null;

  const settings = await getQuoteSettings();
  const rotation = settings?.rotation ?? 'weekly';

  const now = new Date();
  let periodIndex: number;

  if (rotation === 'weekly') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor(
      (now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    periodIndex = weekNumber % quotes.length;
  } else {
    const monthsSinceEpoch =
      now.getFullYear() * 12 + now.getMonth();
    periodIndex = monthsSinceEpoch % quotes.length;
  }

  return quotes[periodIndex];
};

export const createQuote = async (payload: {
  text_en: string;
  text_ar: string;
  sort_order?: number;
  is_active?: boolean;
}) => {
  const { data, error } = await supabase
    .from('login_quotes')
    .insert({
      text_en: payload.text_en,
      text_ar: payload.text_ar,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const updateQuote = async (
  id: string,
  payload: {
    text_en?: string;
    text_ar?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from('login_quotes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const deleteQuote = async (id: string) => {
  const { error } = await supabase
    .from('login_quotes')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
};

export const reorderQuotes = async (orderedIds: string[]) => {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('login_quotes')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
  );

  await Promise.all(updates);
  return true;
};

export const updateQuoteSettings = async (rotation: 'weekly' | 'monthly') => {
  const { data: existing } = await supabase
    .from('login_quote_settings')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('login_quote_settings')
      .update({ rotation, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await supabase
      .from('login_quote_settings')
      .insert({ rotation })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};
