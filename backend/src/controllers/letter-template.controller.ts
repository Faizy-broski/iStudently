import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { LetterTemplateService } from '../services/letter-template.service';
import { getEffectiveSchoolId } from '../utils/campus-validation';

const service = new LetterTemplateService();

const VALID_CONTEXTS = ['print_letters', 'email'] as const;

/**
 * GET /api/letter-templates?context=print_letters&campus_id=...
 * List templates for the current campus + context.
 */
export const getTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id;
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const context = (req.query.context as string) || 'print_letters';
    if (!VALID_CONTEXTS.includes(context as any)) {
      res.status(400).json({ success: false, error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(', ')}` });
      return;
    }

    const campus_id = req.query.campus_id as string | undefined;
    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id);

    const userId = req.profile?.id;
    const templates = await service.getTemplates(effectiveSchoolId, context as any, userId);

    res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('[LetterTemplates:getTemplates] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch templates' });
  }
};

/**
 * POST /api/letter-templates
 * Create a new template.
 */
export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id;
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, context, content, is_global, campus_id } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Template name is required' });
      return;
    }
    if (!context || !VALID_CONTEXTS.includes(context)) {
      res.status(400).json({ success: false, error: `context must be one of: ${VALID_CONTEXTS.join(', ')}` });
      return;
    }

    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id);

    const template = await service.create({
      school_id: effectiveSchoolId,
      name,
      context,
      content: content || '',
      is_global: is_global === true,
      created_by: req.profile?.id,
    });

    res.status(201).json({ success: true, data: template, message: 'Template created successfully' });
  } catch (error: any) {
    console.error('[LetterTemplates:createTemplate] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create template' });
  }
};

/**
 * PUT /api/letter-templates/:id
 * Update an existing template.
 */
export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id;
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, content, is_global, campus_id } = req.body;

    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id);

    // Verify the template exists and belongs to this campus
    const existing = await service.getById(id, effectiveSchoolId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    const template = await service.update(id, effectiveSchoolId, {
      name,
      content,
      is_global,
    });

    res.json({ success: true, data: template, message: 'Template updated successfully' });
  } catch (error: any) {
    console.error('[LetterTemplates:updateTemplate] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update template' });
  }
};

/**
 * DELETE /api/letter-templates/:id
 * Delete a template.
 */
export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id;
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const campus_id = req.query.campus_id as string | undefined;
    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id);

    const existing = await service.getById(id, effectiveSchoolId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    await service.delete(id, effectiveSchoolId);

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('[LetterTemplates:deleteTemplate] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete template' });
  }
};
