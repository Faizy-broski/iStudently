'use client';

import useSWR from 'swr';
import { getSchoolSettings, type SchoolSettings } from '@/lib/api/school-settings';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { useMemo } from 'react';

/**
 * Hook to fetch and provide school-wide or campus-specific settings.
 */
export function useSchoolSettings() {
  const { selectedCampus } = useCampus();
  const { profile } = useAuth();
  
  const campusId = selectedCampus?.id || profile?.campus_id;

  const { data, error, mutate, isLoading } = useSWR(
    campusId ? `school-settings-${campusId}` : 'school-settings-default',
    () => getSchoolSettings(campusId || undefined)
  );

  const settings = data?.success ? data.data : null;

  const currencySymbol = useMemo(() => {
    return settings?.default_currency?.split(' ')[0] || '$';
  }, [settings?.default_currency]);

  /**
   * Helper to format a number with the campus-specific currency.
   */
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return amount;
    
    // We can use the currency ISO code if available, or just the symbol
    // For now, let's use the symbol + localized number
    return `${currencySymbol} ${num.toLocaleString()}`;
  };

  return {
    settings,
    currencySymbol,
    formatCurrency,
    isLoading,
    error,
    refresh: mutate,
  };
}
