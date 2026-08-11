import { Router } from 'express';
import { CertificateTemplateController } from '../controllers/certificate-template.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();
const controller = new CertificateTemplateController();

// All routes require authentication
router.use(authenticate);

// Get available tokens for a recipient type (accessible to all authenticated users)
router.get('/tokens/:recipient_type', controller.getAvailableTokens.bind(controller));

// Preview template with sample data (admin only)
router.post('/preview', requireRole('admin'), controller.previewTemplate.bind(controller));

// Template management (admin only)
router.get('/', requireRole('admin'), controller.getTemplates.bind(controller));
router.get('/:id', requireRole('admin'), controller.getTemplateById.bind(controller));
router.post('/', requireRole('admin'), controller.createTemplate.bind(controller));
router.post('/:id/duplicate', requireRole('admin'), controller.duplicateTemplate.bind(controller));
router.put('/:id', requireRole('admin'), controller.updateTemplate.bind(controller));
router.delete('/:id', requireRole('admin'), controller.deleteTemplate.bind(controller));

export default router;
