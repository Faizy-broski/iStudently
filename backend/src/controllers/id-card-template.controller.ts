import { Request, Response } from 'express';
import { IdCardTemplateService, SUBSTITUTION_TOKENS } from '../services/id-card-template.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const templateService = new IdCardTemplateService();

export class IdCardTemplateController {
  /**
   * Get all templates for the current campus
   */
  async getTemplates(req: AuthRequest, res: Response) {
    try {
      // For admins, school_id is the campus they're managing
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      const { user_type } = req.query;

      if (!campusId) {
        return res.status(400).json({ error: 'School/Campus ID not found in profile' });
      }

      const templates = await templateService.getTemplatesByCampus(
        campusId,
        user_type as string
      );

      res.json({ templates });
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get active template for a user type
   */
  async getActiveTemplate(req: AuthRequest, res: Response) {
    try {
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      const { user_type } = req.params;

      if (!campusId) {
        return res.status(400).json({ error: 'School/Campus ID not found in profile' });
      }

      const template = await templateService.getActiveTemplate(campusId, user_type);

      if (!template) {
        return res.status(404).json({ error: 'No active template found for this user type' });
      }

      res.json({ template });
    } catch (error: any) {
      console.error('Error fetching active template:', error);
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
      console.error('Error fetching template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new template
   */
  async createTemplate(req: AuthRequest, res: Response) {
    try {
      // For admins, school_id is the campus they're managing
      const campusId = req.profile?.school_id || req.profile?.campus_id;
      const userId = req.profile?.id;
      const { name, description, user_type, template_config } = req.body;

      if (!campusId) {
        return res.status(400).json({ error: 'School/Campus ID not found in profile' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID not found in profile' });
      }

      if (!name || !user_type || !template_config) {
        return res.status(400).json({ error: 'Missing required fields: name, user_type, template_config' });
      }

      if (!['student', 'teacher', 'staff'].includes(user_type)) {
        return res.status(400).json({ error: 'Invalid user_type. Must be student, teacher, or staff' });
      }

      const template = await templateService.createTemplate(
        campusId,
        name,
        description,
        user_type,
        template_config,
        userId
      );

      res.status(201).json({ template, message: 'Template created successfully' });
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update template
   */
  async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, template_config } = req.body;

      const updates: any = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (template_config) updates.template_config = template_config;

      const template = await templateService.updateTemplate(id, updates);

      res.json({ template, message: 'Template updated successfully' });
    } catch (error: any) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Set template as active
   */
  async setActiveTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await templateService.setActiveTemplate(id);

      res.json({ template, message: 'Template activated successfully' });
    } catch (error: any) {
      console.error('Error activating template:', error);
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

      res.json({ message: 'Template deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get available substitution tokens for a user type
   */
  async getAvailableTokens(req: AuthRequest, res: Response) {
    try {
      const { user_type } = req.params;
      const schoolId = req.profile?.school_id;

      if (!['student', 'teacher', 'staff'].includes(user_type)) {
        return res.status(400).json({ error: 'Invalid user_type. Must be student, teacher, or staff' });
      }

      // If school ID is available, get tokens with custom fields
      let tokens;
      if (schoolId) {
        tokens = await templateService.getAvailableTokensWithCustomFields(user_type, schoolId);
      } else {
        tokens = templateService.getAvailableTokens(user_type);
      }

      // Convert to array format for easier dropdown consumption
      const tokensArray = Object.entries(tokens).map(([token, label]) => ({
        token,
        label,
        isCustom: token.startsWith('{{custom_'),
        isSeparator: token === '{{---}}'
      }));

      res.json({ tokens: tokensArray });
    } catch (error: any) {
      console.error('Error fetching available tokens:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate student ID card with template
   */
  async generateStudentIdCard(req: AuthRequest, res: Response) {
    try {
      const studentId = req.profile?.student_id;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID not found in profile' });
      }

      const idCard = await templateService.generateStudentIdCard(studentId);

      res.json({ idCard });
    } catch (error: any) {
      console.error('Error generating student ID card:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate teacher ID card with template
   */
  async generateTeacherIdCard(req: AuthRequest, res: Response) {
    try {
      const { teacher_id } = req.query;
      
      if (!teacher_id) {
        return res.status(400).json({ error: 'Teacher ID is required' });
      }

      const idCard = await templateService.generateTeacherIdCard(teacher_id as string);

      res.json({ idCard });
    } catch (error: any) {
      console.error('Error generating teacher ID card:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate staff ID card with template
   */
  async generateStaffIdCard(req: AuthRequest, res: Response) {
    try {
      const { staff_id } = req.query;

      if (!staff_id) {
        return res.status(400).json({ error: 'Staff ID is required' });
      }

      const idCard = await templateService.generateStaffIdCard(staff_id as string);

      res.json({ idCard });
    } catch (error: any) {
      console.error('Error generating staff ID card:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(req: AuthRequest, res: Response) {
    try {
      const { template_config, user_type } = req.body;

      if (!template_config || !user_type) {
        return res.status(400).json({ error: 'Missing required fields: template_config, user_type' });
      }

      // Generate sample data based on user type
      const sampleData: Record<string, any> = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        date_of_birth: '2005-01-15',
        gender: 'Male',
        address: '123 Main Street, City, State',
        photo_url: 'https://via.placeholder.com/150',
        school_name: 'Sample School',
        school_address: '456 School Avenue, City, State',
        school_phone: '+1234567891',
        school_logo: 'https://via.placeholder.com/100',
      };

      if (user_type === 'student') {
        Object.assign(sampleData, {
          student_id: 'STU-2024-001',
          admission_number: 'ADM-001',
          admission_date: '2024-01-15',
          section: 'A',
          grade_level: '10th Grade',
          roll_number: '15',
          blood_group: 'O+',
          parent_name: 'Jane Doe',
          parent_phone: '+1234567892',
          emergency_contact: '+1234567892',
        });
      } else if (user_type === 'teacher') {
        Object.assign(sampleData, {
          employee_id: 'EMP-T-001',
          designation: 'Senior Teacher',
          department: 'Mathematics',
          subjects: 'Algebra, Calculus',
          joining_date: '2020-06-01',
          qualification: 'M.Ed Mathematics',
          specialization: 'Advanced Mathematics',
          experience: '5 years',
          blood_group: 'A+',
          emergency_contact: '+1234567893',
        });
      } else if (user_type === 'staff') {
        Object.assign(sampleData, {
          employee_id: 'EMP-S-001',
          role: 'Administrative Assistant',
          department: 'Administration',
          joining_date: '2021-03-01',
          qualification: 'B.Com',
          blood_group: 'B+',
          emergency_contact: '+1234567894',
        });
      }

      // Process template with sample data
      const processedTemplate = (templateService as any).processTemplate(template_config, sampleData);

      res.json({
        template_config: processedTemplate,
        sample_data: sampleData,
      });
    } catch (error: any) {
      console.error('Error previewing template:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
