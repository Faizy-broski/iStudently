import { Response } from 'express';
import { CertificateTemplateService, CERTIFICATE_RECIPIENT_TYPES } from '../services/certificate-template.service';
import { setupStatusService } from '../services/setup-status.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const templateService = new CertificateTemplateService();

// A tiny inline gray-silhouette SVG — used as the sample photo/logo in previews so the
// builder never depends on an external placeholder service (which is exactly what broke
// the "School Logo" preview: https://via.placeholder.com/* is no longer reliable).
const SAMPLE_AVATAR_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e5e7eb"/>' +
      '<circle cx="50" cy="38" r="18" fill="%239ca3af"/><path d="M18 88c0-20 14-32 32-32s32 12 32 32" fill="%239ca3af"/></svg>'
  );

const SAMPLE_STUDENT_GRADES = [
  { Subject: 'Mathematics', Grade: 'A', Percent: '94%' },
  { Subject: 'Science', Grade: 'B+', Percent: '88%' },
  { Subject: 'English', Grade: 'A-', Percent: '91%' },
];

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
      if (!CERTIFICATE_RECIPIENT_TYPES.includes(recipient_type)) {
        return res.status(400).json({ error: `Invalid recipient_type. Must be one of: ${CERTIFICATE_RECIPIENT_TYPES.join(', ')}` });
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

      if (!CERTIFICATE_RECIPIENT_TYPES.includes(recipient_type)) {
        return res.status(400).json({ error: `Invalid recipient_type. Must be one of: ${CERTIFICATE_RECIPIENT_TYPES.join(', ')}` });
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

      // Pull the admin's real campus so the preview shows their actual logo/name instead of a
      // fake one — this is also what fixes the broken "School Logo" preview image, whose old
      // sample value (https://via.placeholder.com/100) points at a domain that no longer
      // reliably resolves.
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      let campus: any = null;
      if (campusId) {
        try {
          campus = await setupStatusService.getCampusById(campusId);
        } catch {
          // Preview must never fail just because the campus lookup did — fall back below.
        }
      }

      const sampleData: Record<string, any> = {
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        photo_url: SAMPLE_AVATAR_DATA_URI,
        campus_name: campus?.name || 'Sample School',
        campus_address: campus?.address || '456 School Avenue, City, State',
        campus_phone: campus?.phone || '+1234567891',
        school_name: campus?.name || 'Sample School',
        school_address: campus?.address || '456 School Avenue, City, State',
        school_phone: campus?.phone || '+1234567891',
        school_logo: campus?.logo_url || SAMPLE_AVATAR_DATA_URI,
        school_principal: campus?.principal_name || 'Dr. Jane Smith',
        current_date: new Date().toLocaleDateString(),
        academic_year: '2025-2026',
      };

      if (recipient_type === 'student') {
        Object.assign(sampleData, {
          grade_level: '10th Grade',
          section: 'A',
          student_id: 'STU-2024-001',
        });
        // Sample rows for a "table" field with dataSource: 'student_grades' — see
        // CertificateCanvasRenderer.tsx / certificateRender.ts, which read this same shape
        // for real recipients via getStudentGradesSummaryAPI.
        sampleData.__tables = { student_grades: SAMPLE_STUDENT_GRADES };
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
      } else if (recipient_type === 'librarian') {
        Object.assign(sampleData, { role: 'Librarian', department: 'Library', employee_id: 'EMP-L-001' });
      } else if (recipient_type === 'counselor') {
        Object.assign(sampleData, { role: 'School Counselor', department: 'Counseling', employee_id: 'EMP-C-001' });
      } else if (recipient_type === 'media_officer') {
        Object.assign(sampleData, { role: 'Media Officer', department: 'Communications', employee_id: 'EMP-M-001' });
      } else if (recipient_type === 'fina_supervisor') {
        Object.assign(sampleData, { role: 'Financial Supervisor', department: 'Finance', employee_id: 'EMP-F-001' });
      } else if (recipient_type === 'admin') {
        Object.assign(sampleData, { role: 'Administrator', department: 'Administration', employee_id: 'EMP-A-001' });
      } else if (recipient_type === 'parent') {
        Object.assign(sampleData, {
          occupation: 'Engineer',
          workplace: 'Acme Corp',
          children_names: 'Jane Doe, Jack Doe',
          children_count: '2',
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
