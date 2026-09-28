// Thin wrapper around weatherapi.com's forecast endpoint (the same endpoint returns
// current conditions, a multi-day forecast, and — with alerts=yes — any active severe
// weather alerts for the queried location, all in one call). Server-only: the API key
// never reaches the frontend.
//
// https://www.weatherapi.com/docs/#apis-forecast

import { config } from '../../config/env';

const BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';

export class WeatherApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

export interface WeatherCondition {
  text: string;
  icon: string;
  code: number;
}

export interface WeatherCurrent {
  temp_c: number;
  temp_f: number;
  feelslike_c: number;
  condition: WeatherCondition;
  humidity: number;
  wind_kph: number;
  last_updated: string;
}

export interface WeatherForecastDay {
  date: string;
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    avgtemp_c: number;
    condition: WeatherCondition;
    daily_chance_of_rain: number;
    maxwind_kph: number;
    totalprecip_mm: number;
  };
}

/** Raw shape of one entry in weatherapi.com's `alerts.alert[]` array. */
export interface WeatherApiAlert {
  headline: string;
  msgtype: string;
  severity: string; // "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown" (met-agency-supplied, not a fixed enum)
  urgency: string;
  areas: string;
  category: string;
  certainty: string;
  event: string;
  note: string;
  effective: string;
  expires: string;
  desc: string;
  instruction: string;
}

export interface WeatherForecastResult {
  location: { name: string; region: string; country: string; localtime: string };
  current: WeatherCurrent;
  forecastDays: WeatherForecastDay[];
  alerts: WeatherApiAlert[];
}

async function callForecastApi(query: string, days: number, includeAlerts: boolean): Promise<any> {
  if (!config.weather.apiKey) {
    throw new WeatherApiError('WEATHER_API_KEY is not configured');
  }
  const url = new URL(BASE_URL);
  url.searchParams.set('key', config.weather.apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('days', String(days));
  url.searchParams.set('aqi', 'no');
  url.searchParams.set('alerts', includeAlerts ? 'yes' : 'no');

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new WeatherApiError(`weatherapi.com request failed: ${(err as Error).message}`, err);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body: any = await response.json();
      detail = body?.error?.message || '';
    } catch {
      /* body wasn't JSON — ignore */
    }
    throw new WeatherApiError(`weatherapi.com returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  try {
    return await response.json();
  } catch (err) {
    throw new WeatherApiError('weatherapi.com returned a response that was not valid JSON', err);
  }
}

/** Current conditions + a short forecast, for the dashboard widget. No alerts requested. */
export async function getCurrentAndForecast(query: string, days = 3): Promise<WeatherForecastResult> {
  const raw = await callForecastApi(query, days, false);
  return {
    location: raw.location,
    current: raw.current,
    forecastDays: raw.forecast?.forecastday ?? [],
    alerts: [],
  };
}

/** Same call, but with weatherapi.com's severe-weather alerts included — used by the poll job. */
export async function getAlerts(query: string): Promise<WeatherApiAlert[]> {
  const raw = await callForecastApi(query, 1, true);
  return raw.alerts?.alert ?? [];
}

/** Cheap connectivity/key check for the admin settings page's "Test connection" button. */
export async function testConnection(query: string): Promise<{ resolvedLocation: string }> {
  const raw = await callForecastApi(query, 1, false);
  const loc = raw.location;
  return { resolvedLocation: [loc?.name, loc?.region, loc?.country].filter(Boolean).join(', ') };
}
