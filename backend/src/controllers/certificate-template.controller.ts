import { Response } from 'express';
import { CertificateTemplateService } from '../services/certificate-template.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const templateService = new CertificateTemplateService();

export class CertificateTemplateController {
  /**
   * Get all templates for the current campus
   */
  async getTemplates(req: AuthRequest, res: Response) {
    try {
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      const { recipient_type } = req.query;

      if (!campusId) {
        return res.status(400).json({ error: 'School/Campus ID not found in profile' });
      }

      const templates = await templateService.getTemplatesByCampus(
        campusId,
        recipient_type as string
      );

      res.json({ templates });
    } catch (error: any) {
      console.error('Error fetching certificate templates:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await templateService.getTemplateById(id);

      res.json({ template });
    } catch (error: any) {
      console.error('Error fetching certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new template
   */
  async createTemplate(req: AuthRequest, res: Response) {
    try {
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      const userId = req.profile?.id;
      const { name, description, recipient_type, template_config, occasion } = req.body;

      if (!campusId) {
        return res.status(400).json({ error: 'School/Campus ID not found in profile' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'User ID not found in profile' });
      }
      if (!name || !recipient_type || !template_config) {
        return res.status(400).json({ error: 'Missing required fields: name, recipient_type, template_config' });
      }
      if (!['student', 'teacher', 'staff'].includes(recipient_type)) {
        return res.status(400).json({ error: 'Invalid recipient_type. Must be student, teacher, or staff' });
      }

      const template = await templateService.createTemplate(
        campusId,
        name,
        description,
        recipient_type,
        template_config,
        userId,
        occasion
      );

      res.status(201).json({ template, message: 'Certificate template created successfully' });
    } catch (error: any) {
      console.error('Error creating certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update template
   */
  async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, template_config, occasion } = req.body;

      const updates: any = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (occasion !== undefined) updates.occasion = occasion;
      if (template_config) updates.template_config = template_config;

      const template = await templateService.updateTemplate(id, updates);

      res.json({ template, message: 'Certificate template updated successfully' });
    } catch (error: any) {
      console.error('Error updating certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.profile?.id;

      if (!userId) {
        return res.status(400).json({ error: 'User ID not found in profile' });
      }

      const template = await templateService.duplicateTemplate(id, userId);

      res.status(201).json({ template, message: 'Certificate template duplicated successfully' });
    } catch (error: any) {
      console.error('Error duplicating certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await templateService.deleteTemplate(id);

      res.json({ message: 'Certificate template deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get available substitution tokens for a recipient type
   */
  async getAvailableTokens(req: AuthRequest, res: Response) {
    try {
      const { recipient_type } = req.params;

      if (!['student', 'teacher', 'staff'].includes(recipient_type)) {
        return res.status(400).json({ error: 'Invalid recipient_type. Must be student, teacher, or staff' });
      }

      const tokens = templateService.getAvailableTokens(recipient_type);

      const tokensArray = Object.entries(tokens).map(([token, label]) => ({
        token,
        label,
      }));

      res.json({ tokens: tokensArray });
    } catch (error: any) {
      console.error('Error fetching available certificate tokens:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(req: AuthRequest, res: Response) {
    try {
      const { template_config, recipient_type } = req.body;

      if (!template_config || !recipient_type) {
        return res.status(400).json({ error: 'Missing required fields: template_config, recipient_type' });
      }

      const sampleData: Record<string, any> = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        photo_url: 'https://via.placeholder.com/150',
        school_name: 'Sample School',
        school_logo: 'https://via.placeholder.com/100',
        school_principal: 'Dr. Jane Smith',
        current_date: new Date().toLocaleDateString(),
        academic_year: '2025-2026',
      };

      if (recipient_type === 'student') {
        Object.assign(sampleData, {
          grade_level: '10th Grade',
          section: 'A',
          student_id: 'STU-2024-001',
        });
      } else if (recipient_type === 'teacher') {
        Object.assign(sampleData, {
          designation: 'Senior Teacher',
          department: 'Mathematics',
          employee_id: 'EMP-T-001',
        });
      } else if (recipient_type === 'staff') {
        Object.assign(sampleData, {
          role: 'Administrative Assistant',
          department: 'Administration',
          employee_id: 'EMP-S-001',
        });
      }

      const processedTemplate = templateService.processTemplate(template_config, sampleData);

      res.json({
        template_config: processedTemplate,
        sample_data: sampleData,
      });
    } catch (error: any) {
      console.error('Error previewing certificate template:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
