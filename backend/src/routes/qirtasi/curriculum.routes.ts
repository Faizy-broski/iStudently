import { Router } from 'express';
import { qirtasiCurriculumController } from '../../controllers/qirtasi/curriculum.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireQirtasiEnabled } from '../../middlewares/qirtasi-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireQirtasiEnabled);

// Reads: any authenticated role in a school with Qirtasi enabled (the
// upload dialog needs the tree for teachers/librarians, browse needs it for
// everyone).
router.get('/:level', qirtasiCurriculumController.list);
router.get('/:level/:id', qirtasiCurriculumController.get);

// Writes: admin-only — this is shared reference data across the whole
// platform, not per-school content.
router.post('/:level', requireRole('admin', 'super_admin'), qirtasiCurriculumController.create);
router.put('/:level/:id', requireRole('admin', 'super_admin'), qirtasiCurriculumController.update);
router.delete('/:level/:id', requireRole('admin', 'super_admin'), qirtasiCurriculumController.remove);

export default router;
