'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type { QaidaProgress, FinishOutcome } from '@/lib/qaida/progress';
import { emptyProgress } from '@/lib/qaida/progress';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/api/schools';

const fetcher = async (url: string) => {
  const token = await getAuthToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  if (json.success !== undefined && json.data !== undefined) {
    return { progress: json.data, ...json };
  }
  return json;
};

export interface SubmitInput {
  stationId: string | null;
  worldId: string | null;
  isReview: boolean;
  seconds: number;
  items: { key: string; correct: boolean }[];
}

/** يستعمل SWRProvider الموجود في المنصّة — لا إعداد إضافي */
export function useQaidaProgress() {
  const { data, error, isLoading, mutate } = useSWR<{ progress: QaidaProgress }>(
    `${API_URL}/qaida/progress`,
    fetcher,
  );

  const submit = useCallback(async (input: SubmitInput): Promise<FinishOutcome | null> => {
    const token = await getAuthToken();
    const res = await fetch(`${API_URL}/qaida/session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    let json = await res.json();
    if (json.success !== undefined && json.data !== undefined) json = json.data;
    
    // Vendor expects { outcome: FinishOutcome, progress: QaidaProgress }
    await mutate({ progress: json.progress }, { revalidate: false });
    return json.outcome;
  }, [mutate]);

  return {
    progress: data?.progress ?? emptyProgress(),
    isLoading,
    error,
    submit,
    refresh: mutate,
  };
}
