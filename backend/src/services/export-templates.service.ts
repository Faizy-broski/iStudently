import { supabase } from '../config/supabase'

// A single column in a tabular export template config — deliberately flat
// (no x/y positioning like certificate/ID-card templates) since this just
// picks/orders/labels columns the integrating screen already knows about.
export interface ExportTemplateColumn {
    key: string
    label: string
    label_ar?: string | null
    visible: boolean
    order: number
}

export interface ExportTemplate {
    id: string
    school_id: string
    campus_id: string | null
    report_key: string
    name: string
    columns: ExportTemplateColumn[]
    is_default: boolean
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface CreateExportTemplateDTO {
    report_key: string
    name: string
    columns: ExportTemplateColumn[]
    is_default?: boolean
}

export interface UpdateExportTemplateDTO {
    name?: string
    columns?: ExportTemplateColumn[]
    is_default?: boolean
}

export class ExportTemplatesService {
    /**
     * All saved templates for one report/screen, scoped to this school
     * (falling back to the school itself when no campus_id is given).
     */
    async getTemplates(schoolId: string, campusId: string | undefined, reportKey: string): Promise<ExportTemplate[]> {
        const effectiveId = campusId || schoolId
        const { data, error } = await supabase
            .from('export_templates')
            .select('*')
            .eq('school_id', schoolId)
            .or(campusId ? `campus_id.eq.${effectiveId},campus_id.is.null` : 'campus_id.is.null')
            .eq('report_key', reportKey)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching export templates:', error)
            throw new Error('Failed to fetch export templates')
        }

        return (data || []) as ExportTemplate[]
    }

    async getDefaultTemplate(schoolId: string, campusId: string | undefined, reportKey: string): Promise<ExportTemplate | null> {
        const templates = await this.getTemplates(schoolId, campusId, reportKey)
        return templates.find(t => t.is_default) ?? null
    }

    async createTemplate(schoolId: string, campusId: string | undefined, createdBy: string, dto: CreateExportTemplateDTO): Promise<ExportTemplate> {
        // Clearing any existing default first keeps the "one default per
        // (school/campus, report_key)" DB constraint from rejecting this
        // insert when the caller wants the new template to become the default.
        if (dto.is_default) {
            await this.clearDefault(schoolId, campusId, dto.report_key)
        }

        const { data, error } = await supabase
            .from('export_templates')
            .insert({
                school_id: schoolId,
                campus_id: campusId ?? null,
                report_key: dto.report_key,
                name: dto.name,
                columns: dto.columns,
                is_default: dto.is_default ?? false,
                created_by: createdBy,
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating export template:', error)
            throw new Error('Failed to create export template')
        }

        return data as ExportTemplate
    }

    async updateTemplate(templateId: string, schoolId: string, dto: UpdateExportTemplateDTO): Promise<ExportTemplate> {
        const existing = await this.getOwned(templateId, schoolId)

        if (dto.is_default) {
            await this.clearDefault(schoolId, existing.campus_id ?? undefined, existing.report_key)
        }

        const { data, error } = await supabase
            .from('export_templates')
            .update({ ...dto, updated_at: new Date().toISOString() })
            .eq('id', templateId)
            .select()
            .single()

        if (error) {
            console.error('Error updating export template:', error)
            throw new Error('Failed to update export template')
        }

        return data as ExportTemplate
    }

    async deleteTemplate(templateId: string, schoolId: string): Promise<void> {
        await this.getOwned(templateId, schoolId)

        const { error } = await supabase
            .from('export_templates')
            .delete()
            .eq('id', templateId)

        if (error) {
            console.error('Error deleting export template:', error)
            throw new Error('Failed to delete export template')
        }
    }

    async setDefault(templateId: string, schoolId: string): Promise<ExportTemplate> {
        const existing = await this.getOwned(templateId, schoolId)
        await this.clearDefault(schoolId, existing.campus_id ?? undefined, existing.report_key)

        const { data, error } = await supabase
            .from('export_templates')
            .update({ is_default: true, updated_at: new Date().toISOString() })
            .eq('id', templateId)
            .select()
            .single()

        if (error) {
            console.error('Error setting default export template:', error)
            throw new Error('Failed to set default export template')
        }

        return data as ExportTemplate
    }

    /** Verifies the template exists and belongs to this school before any write. */
    private async getOwned(templateId: string, schoolId: string): Promise<ExportTemplate> {
        const { data, error } = await supabase
            .from('export_templates')
            .select('*')
            .eq('id', templateId)
            .single()

        if (error || !data) {
            throw new Error('Export template not found')
        }
        if (data.school_id !== schoolId) {
            throw new Error('You can only manage export templates defined by your school')
        }

        return data as ExportTemplate
    }

    private async clearDefault(schoolId: string, campusId: string | undefined, reportKey: string): Promise<void> {
        const effectiveId = campusId || schoolId
        await supabase
            .from('export_templates')
            .update({ is_default: false })
            .eq('school_id', schoolId)
            .eq('report_key', reportKey)
            .eq('is_default', true)
            .or(campusId ? `campus_id.eq.${effectiveId},campus_id.is.null` : 'campus_id.is.null')
    }
}

export const exportTemplatesService = new ExportTemplatesService()
