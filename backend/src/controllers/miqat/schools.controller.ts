import { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService } from '../../services/miqat/miqat.service';
import { encryptKey } from '../../services/miqat/key-management';
import { getMasterKey } from '../../services/miqat/master-key';

const configSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius_m: z.number().int().positive().default(150),
  max_accuracy_m: z.number().int().positive().default(50),
  photo_retention_days: z.number().int().positive().default(7),
  policy_json: z.record(z.string(), z.any()).default({}),
  rotate_signing_key: z.boolean().default(false),
});

class MiqatSchoolsController {
  async get(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      const cfg = await miqatService.getSchoolConfig(schoolId);
      if (!cfg) return res.json({ success: true, data: null });
      // Never return key material, even encrypted, to the browser admin UI.
      const { card_signing_key_ref, previous_key_ref, ...safe } = cfg as any;
      res.json({ success: true, data: safe });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Admin sets/updates geofence + policy. On first call (or when
   * rotate_signing_key is set), a new random card-signing key is generated
   * and the old one demoted to `previous_key_ref` — giving a two-key overlap
   * window so existing printed cards keep working while new ones roll out
   * (spec §5 Layer 1 "Key management").
   */
  async upsert(req: AuthRequest, res: Response) {
    try {
      const parsed = configSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid school config', details: parsed.error.flatten() });
      }
      const schoolId = req.profile?.school_id;
      const existing = await miqatService.getSchoolConfig(schoolId);
      const masterKey = getMasterKey();

      let cardSigningKeyRef = existing?.card_signing_key_ref;
      let previousKeyRef = existing?.previous_key_ref ?? null;

      if (!cardSigningKeyRef || parsed.data.rotate_signing_key) {
        if (cardSigningKeyRef) previousKeyRef = cardSigningKeyRef;
        const newRawKey = crypto.randomBytes(32);
        cardSigningKeyRef = encryptKey(newRawKey, masterKey);
      }

      const { rotate_signing_key, ...cfg } = parsed.data;
      const saved = await miqatService.upsertSchoolConfig({
        ...cfg,
        school_id: schoolId,
        card_signing_key_ref: cardSigningKeyRef,
        previous_key_ref: previousKeyRef,
      });

      const { card_signing_key_ref, previous_key_ref, ...safe } = saved as any;
      res.json({ success: true, data: safe });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatSchoolsController = new MiqatSchoolsController();
