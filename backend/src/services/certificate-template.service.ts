import { supabase } from '../config/supabase';
import { SUBSTITUTION_TOKENS as ID_CARD_SUBSTITUTION_TOKENS } from './id-card-template.service';

// Certificate-only tokens layered on top of the ID card token catalog (student/teacher/staff
// base fields — name, contact, academic, campus/school info, etc. are all shared).
const CERTIFICATE_EXTRA_TOKENS: Record<string, string> = {
  '{{achievement_title}}': 'Achievement Title',
  '{{award_title}}': 'Award Title',
  '{{issuing_authority}}': 'Issuing Authority',
  '{{signature_1_name}}': 'Signature 1 Name',
  '{{signature_1_title}}': 'Signature 1 Title',
  '{{signature_2_name}}': 'Signature 2 Name',
  '{{signature_2_title}}': 'Signature 2 Title',
};

export const CERTIFICATE_SUBSTITUTION_TOKENS = {
  student: { ...ID_CARD_SUBSTITUTION_TOKENS.student, ...CERTIFICATE_EXTRA_TOKENS },
  teacher: { ...ID_CARD_SUBSTITUTION_TOKENS.teacher, ...CERTIFICATE_EXTRA_TOKENS },
  staff: { ...ID_CARD_SUBSTITUTION_TOKENS.staff, ...CERTIFICATE_EXTRA_TOKENS },
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
      fontFamily?: string;
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
}

export class CertificateTemplateService {
  /**
   * Get all templates for a campus
   */
  async getTemplatesByCampus(campusId: string, recipientType?: string) {
    let query = supabase
      .from('certificate_templates')
      .select('*')
      .eq('campus_id', campusId)
      .order('created_at', { ascending: false });

    if (recipientType) {
      query = query.eq('recipient_type', recipientType);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch certificate templates: ${error.message}`);
    return data;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string) {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw new Error(`Failed to fetch certificate template: ${error.message}`);
    return data;
  }

  /**
   * Create new template
   */
  async createTemplate(
    campusId: string,
    name: string,
    description: string | undefined,
    recipientType: string,
    templateConfig: TemplateConfig,
    createdBy: string,
    occasion?: string
  ) {
    this.validateTemplateConfig(templateConfig, recipientType);

    const { data, error } = await supabase
      .from('certificate_templates')
      .insert({
        campus_id: campusId,
        name,
        description,
        recipient_type: recipientType,
        template_config: templateConfig,
        occasion: occasion || 'general',
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create certificate template: ${error.message}`);
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
      occasion?: string;
      template_config?: TemplateConfig;
    }
  ) {
    if (updates.template_config) {
      const template = await this.getTemplateById(templateId);
      this.validateTemplateConfig(updates.template_config, template.recipient_type);
    }

    const { data, error } = await supabase
      .from('certificate_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update certificate template: ${error.message}`);
    return data;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string) {
    const { error } = await supabase
      .from('certificate_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw new Error(`Failed to delete certificate template: ${error.message}`);
    return { success: true };
  }

  /**
   * Duplicate an existing template (used to turn a ready-made design into an editable copy)
   */
  async duplicateTemplate(templateId: string, createdBy: string) {
    const source = await this.getTemplateById(templateId);

    const { data, error } = await supabase
      .from('certificate_templates')
      .insert({
        campus_id: source.campus_id,
        name: `${source.name} (Copy)`,
        description: source.description,
        recipient_type: source.recipient_type,
        template_config: source.template_config,
        occasion: source.occasion,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to duplicate certificate template: ${error.message}`);
    return data;
  }

  /**
   * Validate template configuration - tokens used must be recognized for the recipient type,
   * but plain text/uploaded-image values (no {{token}}) always pass through untouched.
   */
  private validateTemplateConfig(config: TemplateConfig, recipientType: string) {
    const allowedTokens = Object.keys(
      CERTIFICATE_SUBSTITUTION_TOKENS[recipientType as keyof typeof CERTIFICATE_SUBSTITUTION_TOKENS] || {}
    );

    for (const field of config.fields || []) {
      const tokens = field.token.match(/\{\{[^}]+\}\}/g) || [];
      for (const token of tokens) {
        if (!allowedTokens.includes(token)) {
          throw new Error(`Invalid token "${token}" for recipient type "${recipientType}"`);
        }
      }
    }
  }

  /**
   * Substitute tokens with actual data
   */
  substituteTokens(template: string, data: Record<string, any>): string {
    let result = template;

    Object.keys(data).forEach((key) => {
      const token = `{{${key}}}`;
      const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : '';
      result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    // Leave any remaining unresolved tokens blank rather than "N/A" (certificates read better empty)
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result;
  }

  /**
   * Process a template config by substituting all field tokens with sample/real data
   */
  processTemplate(templateConfig: TemplateConfig, data: Record<string, any>): TemplateConfig {
    const processed = JSON.parse(JSON.stringify(templateConfig)); // Deep clone

    processed.fields = (processed.fields || []).map((field: any) => ({
      ...field,
      token: this.substituteTokens(field.token, data),
    }));

    return processed;
  }

  /**
   * Get available tokens for a recipient type (static tokens)
   */
  getAvailableTokens(recipientType: string) {
    return CERTIFICATE_SUBSTITUTION_TOKENS[recipientType as keyof typeof CERTIFICATE_SUBSTITUTION_TOKENS] || {};
  }
}
