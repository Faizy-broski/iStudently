import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService } from '../../services/miqat/miqat.service';
import { decryptKeyOrThrowFriendly } from '../../services/miqat/key-management';
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
      const rawKey = decryptKeyOrThrowFriendly(cfg.card_signing_key_ref, getMasterKey(), `school ${schoolId}'s card signing key`);
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

  /**
   * QR payloads for printing on ID cards. Unlike issue(), this never bumps a revision for a
   * person who already has an active card — it re-signs that same card, so printing (or
   * reprinting) an ID card does not invalidate cards already handed out. A card is issued only
   * for people who have none. Persons outside the admin's school tree are ignored.
   * No `this` in here: Express passes handlers as bare function references.
   */
  async qrBatch(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({ person_ids: z.array(z.string().uuid()).min(1).max(1000) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'person_ids (1-1000 profile ids) is required' });

      const schoolId = req.profile?.school_id;
      const cfg = await miqatService.getSchoolConfig(schoolId);
      if (!cfg) return res.status(400).json({ success: false, error: 'Configure the school (geofence, signing key) before issuing cards' });
      const rawKey = decryptKeyOrThrowFriendly(cfg.card_signing_key_ref, getMasterKey(), `school ${schoolId}'s card signing key`);

      const requested = Array.from(new Set(parsed.data.person_ids));
      const allowed = await miqatService.filterPersonsInSchoolTree(requested, schoolId);
      const personIds = requested.filter((id) => allowed.has(id));
      const latest = await miqatService.getLatestCards(personIds);

      const qr: Record<string, string> = {};
      const failed: Record<string, string> = {};
      const sign = (personId: string, card: { revision: number; issued_at: string }) =>
        signCardPayload(
          { schoolId, personId, cardRevision: card.revision, issuedAt: Math.floor(new Date(card.issued_at).getTime() / 1000) },
          rawKey
        );

      const toIssue: string[] = [];
      for (const personId of personIds) {
        const card = latest.get(personId);
        if (card && card.status === 'active') qr[personId] = sign(personId, card);
        else toIssue.push(personId);
      }

      // Small concurrency: each person is independent, and a school can print hundreds at once.
      for (let i = 0; i < toIssue.length; i += 10) {
        await Promise.all(
          toIssue.slice(i, i + 10).map(async (personId) => {
            try {
              const card = await miqatService.issueCard(personId, req.profile.id);
              qr[personId] = sign(personId, card);
            } catch (err: any) {
              failed[personId] = err?.message || 'Failed to issue card';
            }
          })
        );
      }

      const notAllowed = requested.filter((id) => !allowed.has(id));
      res.json({ success: true, data: { qr, failed, not_allowed: notAllowed } });
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
