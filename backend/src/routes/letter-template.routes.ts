import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/letter-template.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
