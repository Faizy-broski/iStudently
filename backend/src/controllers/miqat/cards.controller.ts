import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService } from '../../services/miqat/miqat.service';
import { decryptKey } from '../../services/miqat/key-management';
import { getMasterKey } from '../../services/miqat/master-key';
import { signCardPayload } from '../../services/miqat/card-crypto';

class MiqatCardsController {
  /** Admin issues (or reissues) a signed card for a person — the QR payload itself, ready to render. */
  async issue(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({ person_id: z.string().uuid() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'person_id is required' });

      const schoolId = req.profile?.school_id;
      const cfg = await miqatService.getSchoolConfig(schoolId);
      if (!cfg) return res.status(400).json({ success: false, error: 'Configure the school (geofence, signing key) before issuing cards' });

      const card = await miqatService.issueCard(parsed.data.person_id, req.profile.id);
      const rawKey = decryptKey(cfg.card_signing_key_ref, getMasterKey());
      const encoded = signCardPayload(
        {
          schoolId,
          personId: parsed.data.person_id,
          cardRevision: card.revision,
          issuedAt: Math.floor(new Date(card.issued_at).getTime() / 1000),
        },
        rawKey
      );

      res.status(201).json({ success: true, data: { card_id: card.id, revision: card.revision, qr_payload: encoded } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Lost card: revoke + immediately reissue at the next revision (spec §5 Layer 1 "Revocation"). */
  async reportLost(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({ person_id: z.string().uuid() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'person_id is required' });

      await miqatService.revokeCard(parsed.data.person_id, 'lost');
      req.body = { person_id: parsed.data.person_id };
      // Reference the exported singleton, not `this` — Express calls route
      // handlers as bare function references (`router.post(path, controller.method)`),
      // so `this` is undefined at call time inside any method invoked that way.
      return miqatCardsController.issue(req, res);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatCardsController = new MiqatCardsController();
