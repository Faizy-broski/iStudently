import { Router } from 'express';
import { IdCardTemplateController } from '../controllers/id-card-template.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();
const controller = new IdCardTemplateController();

// All routes require authentication
router.use(authenticate);

// Get available tokens for a user type (accessible to all authenticated users)
router.get('/tokens/:user_type', controller.getAvailableTokens.bind(controller));

// Generate ID cards for current user (students use their own ID automatically)
router.get('/generate/student', controller.generateStudentIdCard.bind(controller));
router.get('/generate/teacher', controller.generateTeacherIdCard.bind(controller));
router.get('/generate/staff', controller.generateStaffIdCard.bind(controller));

// Preview template with sample data (admin only)
router.post('/preview', requireRole('admin'), controller.previewTemplate.bind(controller));

// Template management (admin only)
router.get('/', requireRole('admin'), controller.getTemplates.bind(controller));
router.get('/active/:user_type', requireRole('admin'), controller.getActiveTemplate.bind(controller));
router.get('/:id', requireRole('admin'), controller.getTemplateById.bind(controller));
router.post('/', requireRole('admin'), controller.createTemplate.bind(controller));
router.put('/:id', requireRole('admin'), controller.updateTemplate.bind(controller));
router.put('/:id/activate', requireRole('admin'), controller.setActiveTemplate.bind(controller));
router.delete('/:id', requireRole('admin'), controller.deleteTemplate.bind(controller));

export default router;
