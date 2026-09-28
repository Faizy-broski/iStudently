import { API_URL } from '@/config/api'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface WeatherAlertConfig {
  id: string
  school_id: string
  campus_id: string | null
  severity_threshold: 'minor' | 'moderate' | 'severe' | 'extreme'
  location_query_override: string | null
  last_polled_at: string | null
  last_poll_status: 'ok' | 'error' | null
  last_poll_error: string | null
}

export interface WeatherCondition {
  text: string
  icon: string
  code: number
}

export interface WeatherForecastResult {
  location: { name: string; region: string; country: string; localtime: string }
  current: { temp_c: number; temp_f: number; feelslike_c: number; condition: WeatherCondition; humidity: number; wind_kph: number }
  forecastDays: { date: string; day: { maxtemp_c: number; mintemp_c: number; condition: WeatherCondition; daily_chance_of_rain: number } }[]
  alerts: unknown[]
}

export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme'
export type AlertStatus = 'draft' | 'approved' | 'sent' | 'rejected' | 'expired'

export interface WeatherAlert {
  id: string
  school_id: string
  campus_id: string | null
  status: AlertStatus
  severity: AlertSeverity
  alert_type: string | null
  headline: string
  description: string
  effective: string | null
  expires: string | null
  drafted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  sent_at: string | null
  sent_via: Record<string, unknown> | null
}

export interface WeatherWidgetData {
  weather: WeatherForecastResult
  activeAlert: WeatherAlert | null
}

// campus_id threaded explicitly for the same reason as lib/api/miqat.ts's withCampus —
// admin accounts don't get campus_id auto-populated on req.profile.
function withCampus(path: string, campusId?: string): string {
  if (!campusId) return path
  return `${path}${path.includes('?') ? '&' : '?'}campus_id=${campusId}`
}

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
}

export async function getConfig(token: string, campusId?: string): Promise<ApiResponse<WeatherAlertConfig>> {
  const res = await authedFetch(withCampus('/weather/config', campusId), token)
  return res.json()
}

export async function upsertConfig(
  payload: { severity_threshold?: AlertSeverity; location_query_override?: string | null },
  token: string,
  campusId?: string
): Promise<ApiResponse<WeatherAlertConfig>> {
  const res = await authedFetch(withCampus('/weather/config', campusId), token, { method: 'PUT', body: JSON.stringify(payload) })
  return res.json()
}

export async function testConnection(token: string, campusId?: string): Promise<ApiResponse<{ resolvedLocation: string }>> {
  const res = await authedFetch(withCampus('/weather/config/test', campusId), token, { method: 'POST' })
  return res.json()
}

export async function getWidgetData(token: string, campusId?: string): Promise<ApiResponse<WeatherWidgetData>> {
  const res = await authedFetch(withCampus('/weather/alerts/widget', campusId), token)
  return res.json()
}

export async function listAlerts(token: string, status?: AlertStatus, campusId?: string): Promise<ApiResponse<WeatherAlert[]>> {
  const path = status ? `/weather/alerts?status=${status}` : '/weather/alerts'
  const res = await authedFetch(withCampus(path, campusId), token)
  return res.json()
}

export async function approveAlert(id: string, token: string, campusId?: string): Promise<ApiResponse<WeatherAlert>> {
  const res = await authedFetch(withCampus(`/weather/alerts/${id}/approve`, campusId), token, { method: 'POST' })
  return res.json()
}

export async function rejectAlert(id: string, reason: string, token: string, campusId?: string): Promise<ApiResponse<WeatherAlert>> {
  const res = await authedFetch(withCampus(`/weather/alerts/${id}/reject`, campusId), token, { method: 'POST', body: JSON.stringify({ reason }) })
  return res.json()
}
