import { Router } from 'express';
import { qirtasiFacetsController } from '../../controllers/qirtasi/facets.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireQirtasiEnabled } from '../../middlewares/qirtasi-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireQirtasiEnabled);

// Read-only in this slice — the facet registry is edited via migrations,
// not an admin UI, until the auto-tagger/moderation phase needs one.
router.get('/', qirtasiFacetsController.list);

export default router;
