import { getCurrentAndForecast, getAlerts, testConnection, WeatherApiError } from './weatherapi-client'

jest.mock('../../config/env', () => ({ config: { weather: { apiKey: 'test-key' } } }))

const mockFetch = jest.fn()
global.fetch = mockFetch as any

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('getCurrentAndForecast', () => {
  it('maps the raw weatherapi.com payload into the widget shape', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        location: { name: 'Tripoli', region: '', country: 'Libya', localtime: '2026-01-01 12:00' },
        current: { temp_c: 20, temp_f: 68, feelslike_c: 19, condition: { text: 'Sunny', icon: '', code: 1000 }, humidity: 40, wind_kph: 10, last_updated: '' },
        forecast: { forecastday: [{ date: '2026-01-01', day: {} }] },
      })
    )
    const result = await getCurrentAndForecast('Tripoli', 3)
    expect(result.current.temp_c).toBe(20)
    expect(result.forecastDays).toHaveLength(1)
    expect(result.alerts).toEqual([])
    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.searchParams.get('alerts')).toBe('no')
    expect(calledUrl.searchParams.get('key')).toBe('test-key')
  })

  it('throws WeatherApiError on a non-200 response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: { message: 'Invalid location' } }, false, 400))
    await expect(getCurrentAndForecast('nowhere')).rejects.toThrow(WeatherApiError)
    await expect(getCurrentAndForecast('nowhere')).rejects.toThrow(/Invalid location/)
  })

  it('throws WeatherApiError when the response body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json') } } as any)
    await expect(getCurrentAndForecast('Tripoli')).rejects.toThrow(WeatherApiError)
  })

  it('throws WeatherApiError when the network request itself fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    await expect(getCurrentAndForecast('Tripoli')).rejects.toThrow(WeatherApiError)
  })
})

describe('getAlerts', () => {
  it('requests alerts=yes and returns the alert array', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        location: {}, current: {}, forecast: { forecastday: [] },
        alerts: { alert: [{ headline: 'Flood Warning', severity: 'Severe', event: 'Flood' }] },
      })
    )
    const alerts = await getAlerts('Tripoli')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].headline).toBe('Flood Warning')
    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.searchParams.get('alerts')).toBe('yes')
  })

  it('returns an empty array when weatherapi.com has no alerts field', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ location: {}, current: {}, forecast: { forecastday: [] } }))
    expect(await getAlerts('Tripoli')).toEqual([])
  })
})

describe('testConnection', () => {
  it('resolves a readable location string without leaking the API key', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ location: { name: 'Tripoli', region: 'Tripoli', country: 'Libya' }, current: {}, forecast: { forecastday: [] } }))
    const result = await testConnection('Tripoli')
    expect(result.resolvedLocation).toBe('Tripoli, Tripoli, Libya')
  })
})
