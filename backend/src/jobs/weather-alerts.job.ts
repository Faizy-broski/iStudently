// Standalone node-cron schedule, decoupled from the monolithic cron.service.ts — same
// precedent as jobs/miqat-nightly.job.ts. Polls every school/campus with the module
// enabled for severe weather every 30 minutes, drafting alerts for an admin to review.
// Never sends anything itself.

import cron from 'node-cron';
import { weatherConfigService } from '../services/weather/weather-config.service';
import { weatherAlertService } from '../services/weather/weather-alert.service';

const DEFAULT_TIMEZONE = 'Asia/Karachi'; // only controls when the polling tick fires, not the weather data itself — see module plan

async function pollAllSchools(): Promise<void> {
  const locations = await weatherConfigService.listEnabledLocations();
  for (const { school_id, campus_id } of locations) {
    try {
      const { drafted } = await weatherAlertService.pollLocation(school_id, campus_id);
      if (drafted > 0) {
        console.log(`[weather-alerts] drafted ${drafted} alert(s) for school ${school_id}${campus_id ? ` campus ${campus_id}` : ''}`);
      }
    } catch (err) {
      // pollLocation already swallows and records its own errors — this only catches a
      // truly unexpected failure so one school can never abort the rest of the loop.
      console.error(`[weather-alerts] unexpected failure polling school ${school_id}:`, err);
    }
  }
}

async function expireStaleDrafts(): Promise<void> {
  try {
    const count = await weatherAlertService.expireStaleDrafts();
    if (count > 0) console.log(`[weather-alerts] expired ${count} unreviewed draft(s) past their event window`);
  } catch (err) {
    console.error('[weather-alerts] failed to expire stale drafts:', err);
  }
}

let started = false;

export function startWeatherAlertsJob(): void {
  if (started) return;
  started = true;
  cron.schedule('*/30 * * * *', () => void pollAllSchools(), { scheduled: true, timezone: DEFAULT_TIMEZONE });
  cron.schedule('15 * * * *', () => void expireStaleDrafts(), { scheduled: true, timezone: DEFAULT_TIMEZONE });
}

// Exported for tests / manual triggering.
export { pollAllSchools, expireStaleDrafts };
