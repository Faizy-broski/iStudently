import { supabase } from '../config/supabase';

export interface LetterTemplate {
  id: string;
  school_id: string;
  name: string;
  context: 'print_letters' | 'email';
  content: string;
  is_global: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLetterTemplateDTO {
  school_id: string;
  name: string;
  context: 'print_letters' | 'email';
  content: string;
  is_global?: boolean;
  created_by?: string;
}

export interface UpdateLetterTemplateDTO {
  name?: string;
  content?: string;
  is_global?: boolean;
}

export class LetterTemplateService {
  /**
   * List all templates for a campus filtered by context.
   * Returns campus-wide (is_global) + templates created by the requesting user.
   * When created_by_id is not provided, returns all campus templates.
   */
  async getTemplates(
    schoolId: string,
    context: 'print_letters' | 'email',
    createdById?: string
  ): Promise<LetterTemplate[]> {
    let query = supabase
      .from('letter_templates')
      .select('*')
      .eq('school_id', schoolId)
      .eq('context', context)
      .order('name', { ascending: true });

    if (createdById) {
      // Show global templates + own templates
      query = query.or(`is_global.eq.true,created_by.eq.${createdById}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[LetterTemplates:getTemplates] DB error:', error);
      throw new Error(error.message);
    }

    return data as LetterTemplate[];
  }

  async getById(id: string, schoolId: string): Promise<LetterTemplate | null> {
    const { data, error } = await supabase
      .from('letter_templates')
      .select('*')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) {
      console.error('[LetterTemplates:getById] DB error:', error);
      throw new Error(error.message);
    }

    return data as LetterTemplate | null;
  }

  async create(dto: CreateLetterTemplateDTO): Promise<LetterTemplate> {
    const { data, error } = await supabase
      .from('letter_templates')
      .insert({
        school_id: dto.school_id,
        name: dto.name.trim(),
        context: dto.context,
        content: dto.content,
        is_global: dto.is_global ?? false,
        created_by: dto.created_by ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[LetterTemplates:create] DB error:', error);
      throw new Error(error.message);
    }

    return data as LetterTemplate;
  }

  async update(
    id: string,
    schoolId: string,
    dto: UpdateLetterTemplateDTO
  ): Promise<LetterTemplate> {
    const updates: Record<string, any> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.content !== undefined) updates.content = dto.content;
    if (dto.is_global !== undefined) updates.is_global = dto.is_global;

    const { data, error } = await supabase
      .from('letter_templates')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) {
      console.error('[LetterTemplates:update] DB error:', error);
      throw new Error(error.message);
    }

    return data as LetterTemplate;
  }

  async delete(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('letter_templates')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) {
      console.error('[LetterTemplates:delete] DB error:', error);
      throw new Error(error.message);
    }
  }
}
