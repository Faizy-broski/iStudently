'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Cloud, Droplets, Wind, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { useCampus } from '@/context/CampusContext'
import { getAuthToken } from '@/lib/api/schools'
import { getWidgetData, type WeatherWidgetData } from '@/lib/api/weather'

/**
 * Self-contained dashboard widget — fetches its own data, so it drops into any role's
 * dashboard with one import + one render line. Only renders once the weather_alerts
 * plugin is confirmed active (also enforced server-side by requireWeatherAlertsEnabled),
 * so it never flashes for a school that hasn't turned the module on.
 */
export function WeatherWidget() {
  const t = useTranslations('weather_alerts.widget')
  const { isPluginActive, loading: settingsLoading } = useSchoolSettings()
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [data, setData] = useState<WeatherWidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const active = isPluginActive('weather_alerts')

  useEffect(() => {
    if (settingsLoading || !active) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    ;(async () => {
      const token = await getAuthToken()
      if (!token) {
        if (!cancelled) { setError(true); setLoading(false) }
        return
      }
      const res = await getWidgetData(token, campusId)
      if (cancelled) return
      if (res.success && res.data) setData(res.data)
      else setError(true)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [settingsLoading, active, campusId])

  if (settingsLoading || !active) return null

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {data?.activeAlert && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 p-2 text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">{data.activeAlert.headline}</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : error || !data ? (
          <p className="text-sm text-muted-foreground">{t('error')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{data.weather.location.name}</p>
                <p className="text-2xl font-bold">{Math.round(data.weather.current.temp_c)}°C</p>
                <p className="text-xs text-muted-foreground">{data.weather.current.condition.text}</p>
              </div>
              {data.weather.current.condition.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https:${data.weather.current.condition.icon}`} alt="" className="h-12 w-12" />
              ) : (
                <Cloud className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {data.weather.current.humidity}%</span>
              <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> {Math.round(data.weather.current.wind_kph)} km/h</span>
            </div>

            {data.weather.forecastDays.length > 0 && (
              <div className="flex justify-between border-t pt-2 mt-1">
                {data.weather.forecastDays.map((d) => (
                  <div key={d.date} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                    <p className="text-xs font-medium">{Math.round(d.day.maxtemp_c)}°/{Math.round(d.day.mintemp_c)}°</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
