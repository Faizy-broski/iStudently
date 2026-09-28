// Per-school(/campus) weather module settings — severity threshold, optional manual
// location override, last-poll status. Campus-row-first, school-wide-fallback lookup,
// same convention as school_settings / miqat_schools_config.

import { supabase } from '../../config/supabase';

export interface WeatherAlertConfig {
  id: string;
  school_id: string;
  campus_id: string | null;
  severity_threshold: 'minor' | 'moderate' | 'severe' | 'extreme';
  location_query_override: string | null;
  last_polled_at: string | null;
  last_poll_status: 'ok' | 'error' | null;
  last_poll_error: string | null;
}

export interface UpsertWeatherAlertConfigDTO {
  school_id: string;
  campus_id?: string | null;
  severity_threshold?: WeatherAlertConfig['severity_threshold'];
  location_query_override?: string | null;
}

const DEFAULT_SEVERITY_THRESHOLD: WeatherAlertConfig['severity_threshold'] = 'moderate';

class WeatherConfigService {
  /** Campus row if campusId is given and exists, else the school-wide (campus_id IS NULL) row, else null. */
  async getConfig(schoolId: string, campusId?: string | null): Promise<WeatherAlertConfig | null> {
    if (campusId) {
      const { data, error } = await supabase
        .from('weather_alert_configs')
        .select('*')
        .eq('school_id', schoolId)
        .eq('campus_id', campusId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    const { data, error } = await supabase
      .from('weather_alert_configs')
      .select('*')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Same as getConfig, but returns sensible defaults instead of null when no row exists yet. */
  async getEffectiveConfig(schoolId: string, campusId?: string | null): Promise<WeatherAlertConfig> {
    const existing = await this.getConfig(schoolId, campusId);
    if (existing) return existing;
    return {
      id: '',
      school_id: schoolId,
      campus_id: campusId ?? null,
      severity_threshold: DEFAULT_SEVERITY_THRESHOLD,
      location_query_override: null,
      last_polled_at: null,
      last_poll_status: null,
      last_poll_error: null,
    };
  }

  async upsertConfig(dto: UpsertWeatherAlertConfigDTO): Promise<WeatherAlertConfig> {
    const campusId = dto.campus_id ?? null;
    let existingQuery = supabase.from('weather_alert_configs').select('id').eq('school_id', dto.school_id);
    existingQuery = campusId ? existingQuery.eq('campus_id', campusId) : existingQuery.is('campus_id', null);
    const existing = await existingQuery.maybeSingle();

    const row = {
      school_id: dto.school_id,
      campus_id: campusId,
      ...(dto.severity_threshold ? { severity_threshold: dto.severity_threshold } : {}),
      ...(dto.location_query_override !== undefined ? { location_query_override: dto.location_query_override } : {}),
      updated_at: new Date().toISOString(),
    };

    if (existing.data?.id) {
      const { data, error } = await supabase
        .from('weather_alert_configs')
        .update(row)
        .eq('id', existing.data.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('weather_alert_configs')
      .insert({ severity_threshold: DEFAULT_SEVERITY_THRESHOLD, ...row })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async recordPollResult(schoolId: string, campusId: string | null, status: 'ok' | 'error', errorMessage?: string): Promise<void> {
    // Ensure a row exists (first poll for a school that never opened its settings page).
    await this.upsertConfig({ school_id: schoolId, campus_id: campusId });
    let updateQuery = supabase
      .from('weather_alert_configs')
      .update({
        last_polled_at: new Date().toISOString(),
        last_poll_status: status,
        last_poll_error: status === 'error' ? (errorMessage ?? null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('school_id', schoolId);
    updateQuery = campusId ? updateQuery.eq('campus_id', campusId) : updateQuery.is('campus_id', null);
    await updateQuery;
  }

  /** Every (school_id, campus_id) pair with the plugin turned on — drives the poll job. */
  async listEnabledLocations(): Promise<{ school_id: string; campus_id: string | null }[]> {
    const { data, error } = await supabase
      .from('school_settings')
      .select('school_id, campus_id, active_plugins')
      .not('active_plugins', 'is', null);
    if (error) throw error;
    return (data || [])
      .filter((row: any) => !!row.active_plugins?.weather_alerts)
      .map((row: any) => ({ school_id: row.school_id, campus_id: row.campus_id }));
  }
}

export const weatherConfigService = new WeatherConfigService();
