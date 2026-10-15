// Weather alerts (plugin, school admin): detection settings and the draft → approve/reject queue.
// Same endpoints as frontend/src/lib/api/weather.ts; routers: weather/config.routes.ts, weather/alerts.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme'
export type WeatherAlertStatus = 'draft' | 'approved' | 'sent' | 'rejected' | 'expired'

export interface WeatherAlertConfig {
  id: string
  campus_id: string | null
  severity_threshold: AlertSeverity
  location_query_override: string | null
  last_polled_at: string | null
  last_poll_status: 'ok' | 'error' | null
  last_poll_error: string | null
}

export interface WeatherAlert {
  id: string
  campus_id: string | null
  status: WeatherAlertStatus
  severity: AlertSeverity
  alert_type: string | null
  headline: string
  description: string
  effective: string | null
  expires: string | null
  drafted_at: string
  rejection_reason: string | null
  sent_at: string | null
  sent_via: Record<string, unknown> | null
}

export interface WeatherCondition {
  text: string
  icon: string
}

/** Current weather, the next days and any live alert (GET /weather/alerts/widget). */
export interface WeatherWidgetData {
  weather: {
    location: { name: string; region: string; country: string; localtime: string }
    current: { temp_c: number; condition: WeatherCondition; humidity: number; wind_kph: number }
    forecastDays: { date: string; day: { maxtemp_c: number; mintemp_c: number; condition: WeatherCondition } }[]
  }
  activeAlert: WeatherAlert | null
}

export function adminWeatherApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    widget: (campusId?: string) => api.get<WeatherWidgetData>(`/weather/alerts/widget${qs({ campus_id: campusId })}`),
    config: (campusId?: string) => api.get<WeatherAlertConfig | null>(`/weather/config${qs({ campus_id: campusId })}`),
    saveConfig: (body: { severity_threshold?: AlertSeverity; location_query_override?: string | null }, campusId?: string) =>
      api.put<WeatherAlertConfig>(`/weather/config${qs({ campus_id: campusId })}`, body),
    testConnection: (campusId?: string) => api.post<{ resolvedLocation: string }>(`/weather/config/test${qs({ campus_id: campusId })}`),
    alerts: (status?: WeatherAlertStatus, campusId?: string) => api.get<WeatherAlert[]>(`/weather/alerts${qs({ status, campus_id: campusId })}`),
    approve: (alertId: string, campusId?: string) => api.post<WeatherAlert>(`/weather/alerts/${id(alertId)}/approve${qs({ campus_id: campusId })}`),
    reject: (alertId: string, reason: string, campusId?: string) => api.post<WeatherAlert>(`/weather/alerts/${id(alertId)}/reject${qs({ campus_id: campusId })}`, { reason }),
  }
}
