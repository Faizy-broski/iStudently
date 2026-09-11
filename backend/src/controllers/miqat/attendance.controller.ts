import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService, MiqatEvent } from '../../services/miqat/miqat.service';
import { verifyBatchSignature } from '../../services/miqat/device-crypto';
import { checkGeofence } from '../../services/miqat/geofence';
import { isDuplicateScan, inferDirection, checkClockDrift, checkImpossibleSequence, MiqatEventLike } from '../../services/miqat/anti-replay';
import { MIQAT_FLAG as FLAG } from '../../services/miqat/verification-flags';
import { classifyArrival, LatenessPolicy } from '../../services/miqat/attendance-engine';
import { onMiqatGateEvent } from '../../listeners/fina-miqat-checkin.listener';

const batchEventSchema = z.object({
  event_id: z.string().uuid(),
  person_id: z.string().uuid(),
  event_type: z.enum(['check_in', 'check_out', 'period_present', 'period_absent']),
  scope: z.enum(['gate', 'period']),
  period_id: z.string().uuid().optional(),
  beacon_id: z.string().uuid().optional(),
  device_time: z.string().datetime(),
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number(),
  is_mock_location: z.boolean(),
  location_age_ms: z.number(),
  source: z.enum(['scan', 'manual', 'rotating_code']).default('scan'),
});

const batchSchema = z.object({
  device_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  events: z.array(batchEventSchema).min(1).max(500),
  signature: z.string(),
});

type PerEventResult = { event_id: string; status: 'accepted' | 'duplicate' | 'rejected'; reason?: string };

class MiqatAttendanceController {
  /**
   * The core trust boundary of the whole module: every batch is verified
   * against the uploading device's registered public key before a single
   * event is touched. Per spec, canonical JSON = JSON.stringify(events) with
   * keys in the order the device serialized them — the device and this
   * endpoint must agree on serialization; a real deployment should pin this
   * to a strict canonicalization (e.g. sorted keys) on both ends, flagged in
   * the plan's open items rather than solved here with an unverified guess.
   */
  async batch(req: AuthRequest, res: Response) {
    try {
      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid batch payload', details: parsed.error.flatten() });
      }
      const { device_id, events, signature } = parsed.data;

      const device = await miqatService.getDevice(device_id);
      if (!device) return res.status(403).json({ success: false, error: 'Unknown device' });
      if (device.status !== 'active') return res.status(403).json({ success: false, error: 'DEVICE_REVOKED' });

      const canonicalJson = JSON.stringify(events);
      if (!verifyBatchSignature(canonicalJson, signature, device.public_key)) {
        return res.status(401).json({ success: false, error: 'Invalid batch signature' });
      }

      await miqatService.touchDeviceLastSeen(device_id);

      const schoolConfig = await miqatService.getSchoolConfig(device.school_id);
      if (!schoolConfig) return res.status(400).json({ success: false, error: 'Miqat is not configured for this school' });

      const serverTime = new Date();
      const results: PerEventResult[] = [];
      // Process oldest-first so direction inference and dedupe see a
      // consistent chronological order regardless of upload order.
      const ordered = [...events].sort((a, b) => new Date(a.device_time).getTime() - new Date(b.device_time).getTime());
      // Per-person running "last gate event" cache, seeded lazily from the DB
      // and threaded through the batch so multiple events for the same
      // person in one batch chain correctly without extra round trips.
      const lastGateEventCache = new Map<string, MiqatEventLike | null>();

      for (const evt of ordered) {
        const deviceTime = new Date(evt.device_time);
        let flags = FLAG.DEVICE_OK; // batch signature already verified above

        const geofence = checkGeofence(
          { lat: evt.lat, lng: evt.lng, accuracyM: evt.accuracy_m, isMockLocation: evt.is_mock_location, locationAgeMs: evt.location_age_ms },
          { lat: schoolConfig.lat ?? 0, lng: schoolConfig.lng ?? 0, radiusM: schoolConfig.radius_m, maxAccuracyM: schoolConfig.max_accuracy_m }
        );
        if (!geofence.ok) {
          results.push({ event_id: evt.event_id, status: 'rejected', reason: geofence.reason });
          continue;
        }
        flags |= FLAG.GEOFENCE_OK;

        let lastGateEvent = lastGateEventCache.get(evt.person_id);
        if (lastGateEvent === undefined) {
          lastGateEvent = (await miqatService.getLastEventForPerson(evt.person_id, 'gate', evt.device_time)) as unknown as MiqatEventLike | null;
        }

        let eventType = evt.event_type;
        if (evt.scope === 'gate') {
          // Server is authoritative on direction — never trusts the device's
          // claimed check_in/check_out (spec §6, "do not require the
          // operator to select a direction").
          eventType = inferDirection(lastGateEvent);

          const dup = isDuplicateScan(
            lastGateEvent?.eventType === eventType ? lastGateEvent : null,
            deviceTime
          );
          if (dup) {
            results.push({ event_id: evt.event_id, status: 'duplicate' });
            continue;
          }

          const anomaly = checkImpossibleSequence(lastGateEvent, { schoolId: device.school_id, eventType, deviceTime });
          if (anomaly.anomaly) flags |= FLAG.ANOMALY;
        }

        const drift = checkClockDrift(deviceTime, serverTime);
        if (drift.flagged) flags |= FLAG.TIME_DRIFT;

        const row: MiqatEvent = {
          id: evt.event_id,
          school_id: device.school_id,
          person_id: evt.person_id,
          device_id: device.id,
          event_type: eventType,
          scope: evt.scope,
          period_id: evt.period_id ?? null,
          beacon_id: evt.beacon_id ?? null,
          device_time: evt.device_time,
          distance_from_centre_m: Math.round(geofence.distanceM),
          accuracy_m: evt.accuracy_m,
          verification_flags: flags,
          source: evt.source,
          reason_code: null,
          notes: drift.flagged ? `TIME_DRIFT: ${drift.driftMinutes.toFixed(1)} min` : null,
        };

        const outcome = await miqatService.insertEvent(row);
        results.push({ event_id: evt.event_id, status: outcome });

        if (outcome === 'accepted' && evt.scope === 'gate') {
          lastGateEventCache.set(evt.person_id, { schoolId: device.school_id, eventType, deviceTime });

          // Fire-and-forget — Al-Fina' notification must never block or fail
          // the attendance write it's reacting to (see the listener's own
          // try/catch). Late-arrival detection reuses the same pure
          // classifyArrival() the nightly job uses, so "late" here always
          // agrees with what miqat_days ends up recording.
          // eventType is narrowed to 'check_in'|'check_out' here (we're
          // inside the evt.scope === 'gate' branch, which only ever sets it
          // via inferDirection()) — TS can't see that across the branch, so assert.
          let kind: 'check_in' | 'check_out' | 'late_arrival' = eventType as 'check_in' | 'check_out';
          if (eventType === 'check_in' && schoolConfig.policy_json) {
            const policy: LatenessPolicy = {
              officialStartMinutes: schoolConfig.policy_json.official_start_minutes ?? 7 * 60,
              gracePeriodMinutes: schoolConfig.policy_json.grace_period_minutes ?? 5,
              lateCutoffMinutes: schoolConfig.policy_json.late_cutoff_minutes ?? 8 * 60,
            };
            const minutes = deviceTime.getUTCHours() * 60 + deviceTime.getUTCMinutes();
            if (classifyArrival(minutes, policy) === 'late') kind = 'late_arrival';
          }
          void onMiqatGateEvent(device.school_id, evt.person_id, kind);
        }
      }

      res.json({ success: true, data: { batch_id: parsed.data.batch_id, results } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Admin-only manual entry — never silent: reason_code + free text required, visually distinguished in reports (spec §7). */
  async manual(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({
        person_id: z.string().uuid(),
        event_type: z.enum(['check_in', 'check_out', 'period_present', 'period_absent']),
        scope: z.enum(['gate', 'period']),
        period_id: z.string().uuid().optional(),
        device_time: z.string().datetime(),
        reason_code: z.string().min(1),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid manual entry', details: parsed.error.flatten() });
      }
      const schoolId = req.profile?.school_id;
      const row: MiqatEvent = {
        id: require('crypto').randomUUID(),
        school_id: schoolId,
        person_id: parsed.data.person_id,
        event_type: parsed.data.event_type,
        scope: parsed.data.scope,
        period_id: parsed.data.period_id ?? null,
        device_time: parsed.data.device_time,
        verification_flags: 0, // no crypto/geofence/device verification on a manual record, by definition
        source: 'manual',
        created_by_user_id: req.profile.id,
        reason_code: parsed.data.reason_code,
        notes: parsed.data.notes ?? null,
      };
      await miqatService.insertEvent(row);
      res.status(201).json({ success: true, data: row });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async day(req: AuthRequest, res: Response) {
    try {
      const date = req.params.date;
      const classId = req.query.class_id as string | undefined;
      const schoolId = req.profile?.school_id;
      const events = await miqatService.listEventsForDay(schoolId, date, classId);
      res.json({ success: true, data: events });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async summary(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      const { date_from, date_to } = req.query as { date_from?: string; date_to?: string };
      if (!date_from || !date_to) {
        return res.status(400).json({ success: false, error: 'date_from and date_to are required' });
      }
      const rows = await miqatService.summary(schoolId, date_from, date_to);
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Layer 5 — decoupled from the event itself (spec §7): uploaded
   * asynchronously, on its own device-signature-authenticated path so it
   * never needs a platform-user session either. `photo:{event_id}` is the
   * signed canonical string, kept deliberately tiny since the file itself
   * can't be part of a signed payload the same way JSON can.
   */
  async uploadPhoto(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      const { device_id, event_id, signature } = req.body as { device_id?: string; event_id?: string; signature?: string };
      if (!file || !device_id || !event_id || !signature) {
        return res.status(400).json({ success: false, error: 'device_id, event_id, signature and photo file are required' });
      }

      const device = await miqatService.getDevice(device_id);
      if (!device || device.status !== 'active') {
        return res.status(403).json({ success: false, error: 'DEVICE_REVOKED' });
      }
      if (!verifyBatchSignature(`photo:${event_id}`, signature, device.public_key)) {
        return res.status(401).json({ success: false, error: 'Invalid device signature' });
      }

      const storageKey = await miqatService.uploadEventPhoto(device.school_id, event_id, file.buffer, file.mimetype);
      await miqatService.setEventPhotoRef(event_id, storageKey);

      res.status(201).json({ success: true, data: { storage_key: storageKey } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatAttendanceController = new MiqatAttendanceController();
