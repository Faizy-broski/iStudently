import { Router } from 'express';
import { quotesController } from '../controllers/quotes.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/role.middleware';

const router = Router();

router.get('/current', quotesController.getCurrent.bind(quotesController));

router.get('/', authenticate, requireSuperAdmin, quotesController.getAll.bind(quotesController));
router.get('/settings', authenticate, requireSuperAdmin, quotesController.getSettings.bind(quotesController));
router.post('/', authenticate, requireSuperAdmin, quotesController.create.bind(quotesController));
router.put('/settings', authenticate, requireSuperAdmin, quotesController.updateSettings.bind(quotesController));
router.put('/reorder', authenticate, requireSuperAdmin, quotesController.reorder.bind(quotesController));
router.put('/:id', authenticate, requireSuperAdmin, quotesController.update.bind(quotesController));
router.delete('/:id', authenticate, requireSuperAdmin, quotesController.remove.bind(quotesController));

export default router;
