// Severe-weather alert lifecycle: draft (auto-created by the poll job) -> approved+sent
// (an admin reviewed it) or rejected, or expired if nobody reviewed it before the
// underlying weather event's window passed. Never auto-sent — see the module plan for why.

import crypto from 'crypto';
import { supabase } from '../../config/supabase';
import { getAlerts, getCurrentAndForecast, type WeatherApiAlert, type WeatherForecastResult } from './weatherapi-client';
import { weatherConfigService, type WeatherAlertConfig } from './weather-config.service';
import { pushNotificationsService } from '../push-notifications.service';
import { portalService } from '../portal.service';

export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme';
export type AlertStatus = 'draft' | 'approved' | 'sent' | 'rejected' | 'expired';

export interface WeatherAlertRow {
  id: string;
  school_id: string;
  campus_id: string | null;
  status: AlertStatus;
  severity: AlertSeverity;
  alert_type: string | null;
  headline: string;
  description: string;
  effective: string | null;
  expires: string | null;
  raw_payload: WeatherApiAlert;
  dedupe_key: string;
  drafted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  sent_via: Record<string, unknown> | null;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { minor: 0, moderate: 1, severe: 2, extreme: 3 };
const ALERT_AUDIENCE_ROLES = ['admin', 'teacher', 'student', 'parent'];

/** weatherapi.com's `severity` string (met-agency-supplied, inconsistent casing/vocabulary) normalized to our fixed enum. */
function normalizeSeverity(raw: string | undefined): AlertSeverity {
  const s = (raw || '').toLowerCase();
  if (s.includes('extreme')) return 'extreme';
  if (s.includes('severe')) return 'severe';
  if (s.includes('moderate')) return 'moderate';
  if (s.includes('minor')) return 'minor';
  return 'moderate'; // "Unknown" or unrecognized — err toward a human seeing it, not silently dropping it
}

function computeDedupeKey(schoolId: string, campusId: string | null, alert: WeatherApiAlert): string {
  const parts = [schoolId, campusId ?? '', alert.event, alert.headline, alert.effective, alert.expires].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex');
}

class WeatherAlertService {
  /** School's own city/state/address (or the config's manual override) as a weatherapi.com query string. */
  async resolveLocationQuery(schoolId: string, campusId?: string | null): Promise<string> {
    const config = await weatherConfigService.getConfig(schoolId, campusId ?? null);
    if (config?.location_query_override?.trim()) return config.location_query_override.trim();

    const targetId = campusId || schoolId;
    const { data: school, error } = await supabase
      .from('schools')
      .select('city, state, address')
      .eq('id', targetId)
      .single();
    if (error) throw new Error(`Could not resolve location for school ${targetId}: ${error.message}`);

    const parts = [school.city, school.state].filter(Boolean);
    const query = parts.length > 0 ? parts.join(',') : school.address;
    if (!query) throw new Error(`School ${targetId} has no city/state/address set — cannot look up weather`);
    return query;
  }

  async getWidgetData(schoolId: string, campusId?: string | null): Promise<WeatherForecastResult> {
    const query = await this.resolveLocationQuery(schoolId, campusId);
    return getCurrentAndForecast(query, 3);
  }

  /**
   * Polls one school/campus's location, drafts an alert for every severe-enough,
   * not-already-drafted alert found. One school's failure (bad location, API error) is
   * recorded on its config row and never thrown — callers loop many schools per tick.
   */
  async pollLocation(schoolId: string, campusId: string | null): Promise<{ drafted: number }> {
    const config = await weatherConfigService.getEffectiveConfig(schoolId, campusId);
    const thresholdRank = SEVERITY_RANK[config.severity_threshold];

    try {
      const query = await this.resolveLocationQuery(schoolId, campusId);
      const alerts = await getAlerts(query);

      let drafted = 0;
      for (const alert of alerts) {
        const severity = normalizeSeverity(alert.severity);
        if (SEVERITY_RANK[severity] < thresholdRank) continue;

        const dedupeKey = computeDedupeKey(schoolId, campusId, alert);
        const { error } = await supabase.from('weather_alerts').insert({
          school_id: schoolId,
          campus_id: campusId,
          status: 'draft',
          severity,
          alert_type: alert.event || null,
          headline: alert.headline || alert.event || 'Severe weather alert',
          description: alert.desc || alert.note || '',
          effective: alert.effective || null,
          expires: alert.expires || null,
          raw_payload: alert,
          dedupe_key: dedupeKey,
        });
        // Unique violation on the partial dedupe index = already drafted/live for this
        // event, not a real error — every other error is.
        if (error && error.code !== '23505') throw error;
        if (!error) drafted++;
      }

      await weatherConfigService.recordPollResult(schoolId, campusId, 'ok');
      return { drafted };
    } catch (err: any) {
      await weatherConfigService.recordPollResult(schoolId, campusId, 'error', err?.message || String(err));
      return { drafted: 0 };
    }
  }

  async listAlerts(schoolId: string, campusId: string | null, status?: AlertStatus): Promise<WeatherAlertRow[]> {
    let query = supabase.from('weather_alerts').select('*').eq('school_id', schoolId).order('drafted_at', { ascending: false });
    query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  private async getAlertOrThrow(alertId: string): Promise<WeatherAlertRow> {
    const { data, error } = await supabase.from('weather_alerts').select('*').eq('id', alertId).single();
    if (error || !data) throw new Error('Alert not found');
    return data;
  }

  async approveAndSend(alertId: string, reviewerProfileId: string): Promise<WeatherAlertRow> {
    const alert = await this.getAlertOrThrow(alertId);
    if (alert.status !== 'draft') throw new Error(`Alert is already ${alert.status}`);

    const now = new Date().toISOString();
    await supabase
      .from('weather_alerts')
      .update({ status: 'approved', reviewed_by: reviewerProfileId, reviewed_at: now, updated_at: now })
      .eq('id', alertId);

    const sentVia: Record<string, unknown> = {};

    // profiles.school_id equals the specific campus row a user belongs to (not the root
    // tenant id) for multi-campus schools — see auth.middleware.ts's campus_id resolution —
    // so delivery must target the campus id when the alert has one, and only fall back to
    // the root school_id for a school-wide config (a tenant with no separate campus rows).
    const deliveryTargetId = alert.campus_id || alert.school_id;
    try {
      await pushNotificationsService.sendToSchool(deliveryTargetId, ALERT_AUDIENCE_ROLES, {
        title: alert.headline,
        body: alert.description.slice(0, 160),
        tag: 'weather-alert',
      });
      sentVia.push = true;
    } catch (err: any) {
      sentVia.push = false;
      sentVia.pushError = err?.message || String(err);
    }

    try {
      const note = await portalService.createNote({
        school_id: alert.school_id,
        campus_id: deliveryTargetId,
        title: `⚠️ ${alert.headline}`,
        content: alert.description,
        is_pinned: true,
        visible_from: now,
        visible_until: alert.expires || undefined,
        visible_to_roles: ALERT_AUDIENCE_ROLES,
        created_by: reviewerProfileId,
      });
      sentVia.portalNoteId = note.id;
    } catch (err: any) {
      sentVia.portalNote = false;
      sentVia.portalNoteError = err?.message || String(err);
    }

    const { data: updated, error } = await supabase
      .from('weather_alerts')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sent_via: sentVia, updated_at: new Date().toISOString() })
      .eq('id', alertId)
      .select('*')
      .single();
    if (error) throw error;
    return updated;
  }

  async reject(alertId: string, reviewerProfileId: string, reason: string): Promise<WeatherAlertRow> {
    const alert = await this.getAlertOrThrow(alertId);
    if (alert.status !== 'draft') throw new Error(`Alert is already ${alert.status}`);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('weather_alerts')
      .update({ status: 'rejected', reviewed_by: reviewerProfileId, reviewed_at: now, rejection_reason: reason, updated_at: now })
      .eq('id', alertId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Quietly expires any draft whose weather event window has passed without admin review
   * — no escalation, no auto-send, per the confirmed "always human-reviewed" decision.
   */
  async expireStaleDrafts(): Promise<number> {
    const { data, error } = await supabase
      .from('weather_alerts')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'draft')
      .not('expires', 'is', null)
      .lt('expires', new Date().toISOString())
      .select('id');
    if (error) throw error;
    return (data || []).length;
  }
}

export const weatherAlertService = new WeatherAlertService();
