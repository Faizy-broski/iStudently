import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { elibraryReadingService } from '../services/elibrary-reading.service';

// Same campus/school resolution as library.controller.ts's libSchoolId() —
// library data (and this reader state, which is scoped to a library book)
// is stored keyed by the CAMPUS id, not the parent school id.
function libSchoolId(req: AuthRequest): string | null {
  const p = req.profile;
  if (!p) return null;
  return p.campus_id || p.school_id || null;
}

export class ElibraryReadingController {
  async getProgress(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const schoolId = libSchoolId(req);
      const profileId = req.profile?.id;
      if (!schoolId || !profileId) {
        return res.status(400).json({ success: false, error: 'School ID is required' });
      }

      const progress = await elibraryReadingService.getReadingProgress(schoolId, profileId, bookId);
      res.json({ success: true, data: progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async putProgress(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const { lastPageIndex, totalPages } = req.body;
      const schoolId = libSchoolId(req);
      const profileId = req.profile?.id;
      if (!schoolId || !profileId) {
        return res.status(400).json({ success: false, error: 'School ID is required' });
      }
      if (typeof lastPageIndex !== 'number') {
        return res.status(400).json({ success: false, error: 'lastPageIndex is required' });
      }

      const progress = await elibraryReadingService.upsertReadingProgress(
        schoolId,
        profileId,
        bookId,
        lastPageIndex,
        totalPages
      );
      res.json({ success: true, data: progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listBookmarks(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const schoolId = libSchoolId(req);
      const profileId = req.profile?.id;
      if (!schoolId || !profileId) {
        return res.status(400).json({ success: false, error: 'School ID is required' });
      }

      const bookmarks = await elibraryReadingService.listBookmarks(schoolId, profileId, bookId);
      res.json({ success: true, data: bookmarks });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createBookmark(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const { pageIndex, label } = req.body;
      const schoolId = libSchoolId(req);
      const profileId = req.profile?.id;
      if (!schoolId || !profileId) {
        return res.status(400).json({ success: false, error: 'School ID is required' });
      }
      if (typeof pageIndex !== 'number') {
        return res.status(400).json({ success: false, error: 'pageIndex is required' });
      }

      const bookmark = await elibraryReadingService.createBookmark(schoolId, profileId, bookId, pageIndex, label);
      res.json({ success: true, data: bookmark });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteBookmark(req: AuthRequest, res: Response) {
    try {
      const { bookmarkId } = req.params;
      const schoolId = libSchoolId(req);
      const profileId = req.profile?.id;
      if (!schoolId || !profileId) {
        return res.status(400).json({ success: false, error: 'School ID is required' });
      }

      await elibraryReadingService.deleteBookmark(schoolId, profileId, bookmarkId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const elibraryReadingController = new ElibraryReadingController();
