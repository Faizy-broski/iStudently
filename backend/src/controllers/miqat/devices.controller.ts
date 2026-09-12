import { Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService } from '../../services/miqat/miqat.service';
import { verifyDeviceCertificate, issueDeviceCertificate, verifyBatchSignature, generateP256KeyPair } from '../../services/miqat/device-crypto';
import { decryptKey } from '../../services/miqat/key-management';
import { getMasterKey } from '../../services/miqat/master-key';
import { config } from '../../config/env';

// Dev-only fallback so a fresh local checkout works without any .env setup —
// mirrors the pattern already used by services/qaida/attempt-token.ts's
// dev-secret fallback. Regenerated every process start (not persisted), so
// certificates issued in one dev session won't verify after a restart —
// acceptable for local development, never used in production (config/env.ts
// warns loudly if these are unset there).
let devAuthorityKeys: { publicKey: string; privateKey: string } | null = null;
function getAuthorityKeys(): { publicKey: string; privateKey: string } {
  if (config.miqat.authorityPrivateKey && config.miqat.authorityPublicKey) {
    return { privateKey: config.miqat.authorityPrivateKey, publicKey: config.miqat.authorityPublicKey };
  }
  if (config.nodeEnv === 'production') {
    throw new Error('MIQAT_AUTHORITY_PRIVATE_KEY/MIQAT_AUTHORITY_PUBLIC_KEY are not configured');
  }
  if (!devAuthorityKeys) devAuthorityKeys = generateP256KeyPair();
  return devAuthorityKeys;
}

/**
 * Shared device-signature check for the read endpoints below — same scheme
 * as bootstrap() (sign `${purpose}:{deviceId}:{timestamp}`, ±60s). A plain
 * function, not a class method: Express invokes controller methods as bare
 * function references (`router.get(path, controller.method)`), so `this`
 * is undefined at call time inside any method invoked that way — this
 * exact bug already bit cards.controller.ts once, see its comment.
 */
async function authenticateDeviceRequest(req: AuthRequest, res: Response, purpose: string): Promise<any | null> {
  const deviceId = req.params.id;
  const { timestamp, signature } = req.query as { timestamp?: string; signature?: string };
  if (!timestamp || !signature) {
    res.status(400).json({ success: false, error: 'timestamp and signature query params are required' });
    return null;
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60) {
    res.status(401).json({ success: false, error: 'Stale or invalid timestamp' });
    return null;
  }
  const device = await miqatService.getDevice(deviceId);
  if (!device || device.status !== 'active') {
    res.status(403).json({ success: false, error: 'DEVICE_REVOKED' });
    return null;
  }
  const canonical = `${purpose}:${deviceId}:${timestamp}`;
  if (!verifyBatchSignature(canonical, signature, device.public_key)) {
    res.status(401).json({ success: false, error: 'Invalid device signature' });
    return null;
  }
  return device;
}

class MiqatDevicesController {
  /**
   * Admin generates a one-time enrolment code (15 min TTL, single-use). A
   * 'teacher' code must name which teacher it's for — class-period scanning
   * needs to resolve that device's own timetable, unlike gate/admin devices
   * which stay anonymous by design.
   */
  async generateCode(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      const role = req.body?.role;
      const personId = req.body?.person_id as string | undefined;
      if (!['gate', 'teacher', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'role must be one of gate|teacher|admin' });
      }
      if (role === 'teacher' && !personId) {
        return res.status(400).json({ success: false, error: 'person_id (the teacher this device belongs to) is required for role=teacher' });
      }
      const row = await miqatService.createEnrolmentCode(schoolId, role, req.profile.id, personId);
      res.status(201).json({ success: true, data: { code: row.code, expires_at: row.expires_at } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Device enters the code, generates a keypair in secure hardware, sends
   * its public key here. No platform-user auth on this route by design —
   * the scanner device is not a logged-in user; the single-use, 15-minute
   * enrolment code IS its credential (spec §5 Layer 4).
   */
  async enrol(req: AuthRequest, res: Response) {
    try {
      const { code, public_key, label, app_version, os_version } = req.body || {};
      if (!code || !public_key) {
        return res.status(400).json({ success: false, error: 'code and public_key are required' });
      }

      const codeRow = await miqatService.consumeEnrolmentCode(code);
      if (!codeRow) {
        return res.status(400).json({ success: false, error: 'Enrolment code is invalid, expired, or already used' });
      }

      const device = await miqatService.registerDevice({
        school_id: codeRow.school_id,
        role: codeRow.role,
        public_key,
        label,
        app_version,
        os_version,
        enrolled_by: codeRow.created_by,
        person_id: codeRow.person_id ?? null,
      });
      await miqatService.markEnrolmentCodeDevice(code, device.id);

      const authority = getAuthorityKeys();
      const cert = issueDeviceCertificate(
        { deviceId: device.id, schoolId: device.school_id, role: device.role, issuedAt: Math.floor(Date.now() / 1000) },
        authority.privateKey
      );

      res.status(201).json({ success: true, data: { device_id: device.id, device_cert: cert } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Device proves possession of its registered private key by signing
   * `bootstrap:{deviceId}:{timestamp}` — timestamp must be within 60s to
   * bound replay, verified against the device's stored public key. No
   * platform-user JWT involved; the device's own keypair IS its identity.
   */
  async bootstrap(req: AuthRequest, res: Response) {
    try {
      const deviceId = req.params.id;
      const { timestamp, signature } = req.query as { timestamp?: string; signature?: string };
      if (!timestamp || !signature) {
        return res.status(400).json({ success: false, error: 'timestamp and signature query params are required' });
      }
      const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!Number.isFinite(ageSeconds) || ageSeconds > 60) {
        return res.status(401).json({ success: false, error: 'Stale or invalid timestamp' });
      }

      const device = await miqatService.getDevice(deviceId);
      if (!device || device.status !== 'active') {
        return res.status(403).json({ success: false, error: 'DEVICE_REVOKED' });
      }

      const canonical = `bootstrap:${deviceId}:${timestamp}`;
      if (!verifyBatchSignature(canonical, signature, device.public_key)) {
        return res.status(401).json({ success: false, error: 'Invalid device signature' });
      }

      await miqatService.touchDeviceLastSeen(deviceId);

      const [schoolConfig, roster, revocationList] = await Promise.all([
        miqatService.getSchoolConfig(device.school_id),
        miqatService.getRosterBootstrap(device.school_id),
        miqatService.getRevocationList(device.school_id),
      ]);
      if (!schoolConfig) {
        return res.status(400).json({ success: false, error: 'Miqat is not configured for this school yet' });
      }

      // The ONE place raw card-signing key bytes ever leave the server: to
      // an enrolled, signature-authenticated device, so it can verify card
      // scans locally while offline (spec §11). Current + previous key, for
      // the rotation overlap window (spec §5 Layer 1).
      const masterKey = getMasterKey();
      const cardSigningKeysB64 = [schoolConfig.card_signing_key_ref, schoolConfig.previous_key_ref]
        .filter((ref): ref is string => !!ref)
        .map((ref) => decryptKey(ref, masterKey).toString('base64'));

      res.json({
        success: true,
        data: {
          school_config: {
            school_id: schoolConfig.school_id,
            lat: schoolConfig.lat,
            lng: schoolConfig.lng,
            radius_m: schoolConfig.radius_m,
            max_accuracy_m: schoolConfig.max_accuracy_m,
            photo_retention_days: schoolConfig.photo_retention_days,
            policy_json: schoolConfig.policy_json,
            card_signing_keys_b64: cardSigningKeysB64,
            role: device.role,
            person_id: device.person_id ?? null,
          },
          roster,
          revocation_list: revocationList,
          // beacons/schedule joins land in milestone 9 (BLE) and the
          // schedule admin UI — schoolConfig.policy_json already carries
          // whatever lateness/grace policy has been configured so far.
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** A teacher device's own timetabled periods for a given date (defaults to today). */
  async myPeriods(req: AuthRequest, res: Response) {
    try {
      const device = await authenticateDeviceRequest(req, res, 'my-periods');
      if (!device) return;
      if (!device.person_id) {
        return res.status(400).json({ success: false, error: 'This device is not linked to a teacher' });
      }
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const dayOfWeek = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
      const periods = await miqatService.getTeacherPeriodsForDate(device.person_id, device.school_id, dayOfWeek);
      res.json({ success: true, data: periods });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Roster for one (section, period, date) — gate-absent pre-fill + already-scanned status included (spec §7). */
  async periodRoster(req: AuthRequest, res: Response) {
    try {
      const device = await authenticateDeviceRequest(req, res, 'period-roster');
      if (!device) return;
      const { section_id, period_id, date } = req.query as { section_id?: string; period_id?: string; date?: string };
      if (!section_id || !period_id || !date) {
        return res.status(400).json({ success: false, error: 'section_id, period_id and date are required' });
      }
      const roster = await miqatService.getPeriodRoster(device.school_id, section_id, period_id, date);
      res.json({ success: true, data: roster });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const devices = await miqatService.listDevices(req.profile?.school_id);
      res.json({ success: true, data: devices });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Admin revokes a lost/stolen device instantly. */
  async revoke(req: AuthRequest, res: Response) {
    try {
      const { supabase } = require('../../config/supabase');
      const { error } = await supabase
        .from('miqat_devices')
        .update({ status: 'revoked' })
        .eq('id', req.params.id)
        .eq('school_id', req.profile?.school_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatDevicesController = new MiqatDevicesController();
