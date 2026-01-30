import { supabase } from '../config/supabase';

// Available substitution tokens by user type
export const SUBSTITUTION_TOKENS = {
  student: {
    // Profile fields
    '{{first_name}}': 'First Name',
    '{{last_name}}': 'Last Name',
    '{{email}}': 'Email Address',
    '{{phone}}': 'Phone Number',
    '{{date_of_birth}}': 'Date of Birth',
    '{{gender}}': 'Gender',
    '{{address}}': 'Address',
    '{{photo_url}}': 'Profile Photo',
    
    // Student-specific fields
    '{{student_id}}': 'Student ID Number',
    '{{admission_number}}': 'Admission Number',
    '{{admission_date}}': 'Admission Date',
    '{{section}}': 'Section Name',
    '{{grade_level}}': 'Grade Level',
    '{{roll_number}}': 'Roll Number',
    '{{blood_group}}': 'Blood Group',
    '{{parent_name}}': 'Parent Name',
    '{{parent_phone}}': 'Parent Phone',
    '{{emergency_contact}}': 'Emergency Contact',
    
    // Campus fields
    '{{campus_name}}': 'Campus Name',
    '{{campus_address}}': 'Campus Address',
    '{{campus_phone}}': 'Campus Phone',
    '{{campus_code}}': 'Campus Code',
    
    // School fields
    '{{school_name}}': 'School Name',
    '{{school_address}}': 'School Address',
    '{{school_phone}}': 'School Phone',
    '{{school_logo}}': 'School Logo',
  },
  teacher: {
    // Profile fields
    '{{first_name}}': 'First Name',
    '{{last_name}}': 'Last Name',
    '{{email}}': 'Email Address',
    '{{phone}}': 'Phone Number',
    '{{date_of_birth}}': 'Date of Birth',
    '{{gender}}': 'Gender',
    '{{address}}': 'Address',
    '{{photo_url}}': 'Profile Photo',
    
    // Teacher-specific fields
    '{{employee_id}}': 'Employee ID',
    '{{designation}}': 'Designation',
    '{{department}}': 'Department',
    '{{subjects}}': 'Subjects Teaching',
    '{{joining_date}}': 'Joining Date',
    '{{qualification}}': 'Qualification',
    '{{specialization}}': 'Specialization',
    '{{experience}}': 'Years of Experience',
    '{{blood_group}}': 'Blood Group',
    '{{emergency_contact}}': 'Emergency Contact',
    
    // Campus fields
    '{{campus_name}}': 'Campus Name',
    '{{campus_address}}': 'Campus Address',
    '{{campus_phone}}': 'Campus Phone',
    '{{campus_code}}': 'Campus Code',
    
    // School fields
    '{{school_name}}': 'School Name',
    '{{school_address}}': 'School Address',
    '{{school_phone}}': 'School Phone',
    '{{school_logo}}': 'School Logo',
  },
  staff: {
    // Profile fields
    '{{first_name}}': 'First Name',
    '{{last_name}}': 'Last Name',
    '{{email}}': 'Email Address',
    '{{phone}}': 'Phone Number',
    '{{date_of_birth}}': 'Date of Birth',
    '{{gender}}': 'Gender',
    '{{address}}': 'Address',
    '{{photo_url}}': 'Profile Photo',
    
    // Staff-specific fields
    '{{employee_id}}': 'Employee ID',
    '{{role}}': 'Role/Position',
    '{{department}}': 'Department',
    '{{joining_date}}': 'Joining Date',
    '{{qualification}}': 'Qualification',
    '{{blood_group}}': 'Blood Group',
    '{{emergency_contact}}': 'Emergency Contact',
    
    // Campus fields
    '{{campus_name}}': 'Campus Name',
    '{{campus_address}}': 'Campus Address',
    '{{campus_phone}}': 'Campus Phone',
    '{{campus_code}}': 'Campus Code',
    
    // School fields
    '{{school_name}}': 'School Name',
    '{{school_address}}': 'School Address',
    '{{school_phone}}': 'School Phone',
    '{{school_logo}}': 'School Logo',
  },
};

interface TemplateConfig {
  fields: Array<{
    id: string;
    label: string;
    token: string;
    type: 'text' | 'image';
    position: { x: number; y: number };
    size: { width: number; height: number };
    style?: {
      fontSize?: number;
      fontWeight?: string;
      color?: string;
      align?: string;
    };
  }>;
  layout: {
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
  };
  design: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    backgroundImage?: string;
  };
  qrCode?: {
    enabled: boolean;
    position: { x: number; y: number };
    size: number;
    data: string; // Template string with tokens
  };
}

export class IdCardTemplateService {
  /**
   * Get all templates for a campus
   */
  async getTemplatesByCampus(campusId: string, userType?: string) {
    let query = supabase
      .from('id_card_templates')
      .select('*')
      .eq('campus_id', campusId)
      .order('created_at', { ascending: false });

    if (userType) {
      query = query.eq('user_type', userType);
    }

    const { data, error } = await query;
    
    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data;
  }

  /**
   * Get active template for a specific user type
   */
  async getActiveTemplate(campusId: string, userType: string) {
    const { data, error } = await supabase
      .from('id_card_templates')
      .select('*')
      .eq('campus_id', campusId)
      .eq('user_type', userType)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to fetch active template: ${error.message}`);
    }

    return data;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string) {
    const { data, error } = await supabase
      .from('id_card_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw new Error(`Failed to fetch template: ${error.message}`);
    return data;
  }

  /**
   * Create new template
   */
  async createTemplate(
    campusId: string,
    name: string,
    description: string,
    userType: string,
    templateConfig: TemplateConfig,
    createdBy: string
  ) {
    // Validate template config
    this.validateTemplateConfig(templateConfig, userType);

    const { data, error } = await supabase
      .from('id_card_templates')
      .insert({
        campus_id: campusId,
        name,
        description,
        user_type: userType,
        template_config: templateConfig,
        is_active: false,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data;
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      template_config?: TemplateConfig;
    }
  ) {
    if (updates.template_config) {
      // Get template to validate user type
      const template = await this.getTemplateById(templateId);
      this.validateTemplateConfig(updates.template_config, template.user_type);
    }

    const { data, error } = await supabase
      .from('id_card_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update template: ${error.message}`);
    return data;
  }

  /**
   * Set template as active (deactivates others of same user type)
   */
  async setActiveTemplate(templateId: string) {
    const template = await this.getTemplateById(templateId);

    // Deactivate all other templates for this user type
    await supabase
      .from('id_card_templates')
      .update({ is_active: false })
      .eq('campus_id', template.campus_id)
      .eq('user_type', template.user_type);

    // Activate this template
    const { data, error } = await supabase
      .from('id_card_templates')
      .update({ is_active: true })
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw new Error(`Failed to activate template: ${error.message}`);
    return data;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string) {
    const { error } = await supabase
      .from('id_card_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw new Error(`Failed to delete template: ${error.message}`);
    return { success: true };
  }

  /**
   * Validate template configuration
   */
  private validateTemplateConfig(config: TemplateConfig, userType: string) {
    const allowedTokens = Object.keys(SUBSTITUTION_TOKENS[userType as keyof typeof SUBSTITUTION_TOKENS] || {});

    // Check all tokens in fields are valid
    for (const field of config.fields) {
      const tokens = field.token.match(/\{\{[^}]+\}\}/g) || [];
      for (const token of tokens) {
        if (!allowedTokens.includes(token)) {
          throw new Error(`Invalid token "${token}" for user type "${userType}"`);
        }
      }
    }

    // Check QR code data tokens
    if (config.qrCode?.enabled && config.qrCode.data) {
      const tokens = config.qrCode.data.match(/\{\{[^}]+\}\}/g) || [];
      for (const token of tokens) {
        if (!allowedTokens.includes(token)) {
          throw new Error(`Invalid token "${token}" in QR code data for user type "${userType}"`);
        }
      }
    }
  }

  /**
   * Substitute tokens with actual user data
   */
  substituteTokens(template: string, data: Record<string, any>): string {
    let result = template;
    
    // Replace all tokens with actual values
    Object.keys(data).forEach((key) => {
      const token = `{{${key}}}`;
      const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : 'N/A';
      result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    // Replace any remaining tokens with 'N/A'
    result = result.replace(/\{\{[^}]+\}\}/g, 'N/A');

    return result;
  }

  /**
   * Generate ID card data for a student
   */
  async generateStudentIdCard(studentId: string) {
    // Fetch student with all related data
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError) throw new Error(`Failed to fetch student: ${studentError.message}`);

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', student.profile_id)
      .single();

    // Fetch section
    const { data: section } = await supabase
      .from('sections')
      .select('*, grade_levels(*)')
      .eq('id', student.section_id)
      .single();

    // Fetch campus
    const { data: campus } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', student.campus_id)
      .single();

    // Fetch school
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', student.school_id)
      .single();

    // Fetch parent info
    const { data: parentRelation } = await supabase
      .from('student_parent_relations')
      .select('parents(*, profiles(*))')
      .eq('student_id', studentId)
      .eq('is_primary', true)
      .single();

    // Prepare data object for substitution
    const userData = {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      photo_url: profile?.photo_url || '',
      student_id: student.student_id || '',
      admission_number: student.admission_number || '',
      admission_date: student.created_at ? new Date(student.created_at).toLocaleDateString() : '',
      section: section?.name || '',
      grade_level: section?.grade_levels?.name || '',
      roll_number: student.roll_number || '',
      blood_group: student.blood_group || '',
      parent_name: (() => {
        const parents = parentRelation?.parents;
        if (Array.isArray(parents) && parents.length > 0 && parents[0]?.profiles) {
          return `${parents[0].profiles.first_name} ${parents[0].profiles.last_name}`;
        }
        return '';
      })(),
      parent_phone: (() => {
        const parents = parentRelation?.parents;
        if (Array.isArray(parents) && parents.length > 0 && parents[0]?.profiles) {
          return parents[0].profiles.phone || '';
        }
        return '';
      })(),
      emergency_contact: student.emergency_contact || '',
      campus_name: campus?.name || '',
      campus_address: campus?.address || '',
      campus_phone: campus?.phone || '',
      campus_code: campus?.code || '',
      school_name: school?.name || '',
      school_address: school?.address || '',
      school_phone: school?.phone || '',
      school_logo: school?.logo_url || '',
    };

    // Get active template
    const template = await this.getActiveTemplate(student.campus_id, 'student');
    if (!template) {
      throw new Error('No active student ID card template found for this campus');
    }

    // Substitute tokens in template config
    const processedTemplate = this.processTemplate(template.template_config, userData);

    return {
      ...template,
      template_config: processedTemplate,
      user_data: userData,
    };
  }

  /**
   * Generate ID card data for a teacher
   */
  async generateTeacherIdCard(teacherId: string) {
    // Fetch teacher with all related data
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (teacherError) throw new Error(`Failed to fetch teacher: ${teacherError.message}`);

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', teacher.profile_id)
      .single();

    // Fetch campus
    const { data: campus } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', teacher.campus_id)
      .single();

    // Fetch school
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', teacher.school_id)
      .single();

    // Fetch subjects
    const { data: assignments } = await supabase
      .from('teacher_subject_assignments')
      .select('subjects(name)')
      .eq('teacher_id', teacherId);

    const subjects = assignments?.map((a: any) => a.subjects?.name).filter(Boolean).join(', ') || '';

    // Prepare data object
    const userData = {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      photo_url: profile?.photo_url || '',
      employee_id: teacher.employee_id || '',
      designation: teacher.designation || '',
      department: teacher.department || '',
      subjects: subjects,
      joining_date: teacher.joining_date ? new Date(teacher.joining_date).toLocaleDateString() : '',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      experience: teacher.experience_years ? `${teacher.experience_years} years` : '',
      blood_group: teacher.blood_group || '',
      emergency_contact: teacher.emergency_contact || '',
      campus_name: campus?.name || '',
      campus_address: campus?.address || '',
      campus_phone: campus?.phone || '',
      campus_code: campus?.code || '',
      school_name: school?.name || '',
      school_address: school?.address || '',
      school_phone: school?.phone || '',
      school_logo: school?.logo_url || '',
    };

    // Get active template
    const template = await this.getActiveTemplate(teacher.campus_id, 'teacher');
    if (!template) {
      throw new Error('No active teacher ID card template found for this campus');
    }

    // Process template
    const processedTemplate = this.processTemplate(template.template_config, userData);

    return {
      ...template,
      template_config: processedTemplate,
      user_data: userData,
    };
  }

  /**
   * Generate ID card data for staff
   */
  async generateStaffIdCard(staffId: string) {
    // Fetch staff with all related data
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .single();

    if (staffError) throw new Error(`Failed to fetch staff: ${staffError.message}`);

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', staff.profile_id)
      .single();

    // Fetch campus
    const { data: campus } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', staff.campus_id)
      .single();

    // Fetch school
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', staff.school_id)
      .single();

    // Prepare data object
    const userData = {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      photo_url: profile?.photo_url || '',
      employee_id: staff.employee_id || '',
      role: staff.role || '',
      department: staff.department || '',
      joining_date: staff.joining_date ? new Date(staff.joining_date).toLocaleDateString() : '',
      qualification: staff.qualification || '',
      blood_group: staff.blood_group || '',
      emergency_contact: staff.emergency_contact || '',
      campus_name: campus?.name || '',
      campus_address: campus?.address || '',
      campus_phone: campus?.phone || '',
      campus_code: campus?.code || '',
      school_name: school?.name || '',
      school_address: school?.address || '',
      school_phone: school?.phone || '',
      school_logo: school?.logo_url || '',
    };

    // Get active template
    const template = await this.getActiveTemplate(staff.campus_id, 'staff');
    if (!template) {
      throw new Error('No active staff ID card template found for this campus');
    }

    // Process template
    const processedTemplate = this.processTemplate(template.template_config, userData);

    return {
      ...template,
      template_config: processedTemplate,
      user_data: userData,
    };
  }

  /**
   * Process template by substituting all tokens
   */
  private processTemplate(templateConfig: TemplateConfig, userData: Record<string, any>): TemplateConfig {
    const processed = JSON.parse(JSON.stringify(templateConfig)); // Deep clone

    // Process fields
    processed.fields = processed.fields.map((field: any) => ({
      ...field,
      token: this.substituteTokens(field.token, userData),
    }));

    // Process QR code data
    if (processed.qrCode?.enabled && processed.qrCode.data) {
      processed.qrCode.data = this.substituteTokens(processed.qrCode.data, userData);
    }

    return processed;
  }

  /**
   * Get available tokens for a user type
   */
  getAvailableTokens(userType: string) {
    return SUBSTITUTION_TOKENS[userType as keyof typeof SUBSTITUTION_TOKENS] || {};
  }
}
