import { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService, MiqatEvent } from '../../services/miqat/miqat.service';
import { encryptKey, decryptKey } from '../../services/miqat/key-management';
import { getMasterKey } from '../../services/miqat/master-key';
import { generateRotatingCode, verifyRotatingCode } from '../../services/miqat/rotating-code';
import { isDuplicateScan, inferDirection, MiqatEventLike } from '../../services/miqat/anti-replay';
import { onMiqatGateEvent } from '../../listeners/fina-miqat-checkin.listener';

const STEP_SECONDS = 30;

async function getOrCreateStaffSecret(personId: string): Promise<Buffer> {
  const masterKey = getMasterKey();
  const existingRef = await miqatService.getStaffSecretRef(personId);
  if (existingRef) return decryptKey(existingRef, masterKey);

  const raw = crypto.randomBytes(32);
  await miqatService.createStaffSecretRef(personId, encryptKey(raw, masterKey));
  return raw;
}

class MiqatStaffCodeController {
  /** Staff app polls this every ~25s to refresh its displayed QR — see the migration's comment on why the secret stays server-side. */
  async mine(req: AuthRequest, res: Response) {
    try {
      const personId = req.profile.id;
      const secret = await getOrCreateStaffSecret(personId);
      const { code } = generateRotatingCode(personId, secret);
      res.json({ success: true, data: { qr_payload: `${personId}.${code}`, expires_in_seconds: STEP_SECONDS } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Admin/gate operator scans the staff QR; verified and recorded as a normal gate event, source='rotating_code'. */
  async verify(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({ qr_payload: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'qr_payload is required' });

      const [personId, code] = parsed.data.qr_payload.split('.');
      if (!personId || !code) return res.status(400).json({ success: false, error: 'Malformed staff code' });

      const secretRef = await miqatService.getStaffSecretRef(personId);
      if (!secretRef) return res.status(404).json({ success: false, error: 'No rotating code enrolled for this person' });

      const secret = decryptKey(secretRef, getMasterKey());
      if (!verifyRotatingCode(code, secret)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired code' });
      }

      const schoolId = req.profile?.school_id;
      const nowIso = new Date().toISOString();
      const lastGateEvent = (await miqatService.getLastEventForPerson(personId, 'gate', nowIso)) as unknown as MiqatEventLike | null;

      if (isDuplicateScan(lastGateEvent, new Date(nowIso))) {
        return res.json({ success: true, data: { status: 'duplicate' } });
      }

      const eventType = inferDirection(lastGateEvent);
      const row: MiqatEvent = {
        id: crypto.randomUUID(),
        school_id: schoolId,
        person_id: personId,
        event_type: eventType,
        scope: 'gate',
        device_time: nowIso,
        verification_flags: 0, // no geofence/device-signature layer for this v3 path — see rotating-code.ts's doc comment
        source: 'rotating_code',
      };
      await miqatService.insertEvent(row);
      void onMiqatGateEvent(schoolId, personId, eventType);

      res.json({ success: true, data: { status: 'accepted', event_type: eventType } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatStaffCodeController = new MiqatStaffCodeController();
