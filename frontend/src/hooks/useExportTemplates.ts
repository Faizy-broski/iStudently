"use client";

import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import * as exportTemplatesApi from '@/lib/api/export-templates';
import type { CreateExportTemplateDTO, UpdateExportTemplateDTO } from '@/lib/api/export-templates';

/**
 * Saved export templates (column configs) for one report/screen — mirrors
 * useStudents.ts's SWR conventions. `reportKey` is the stable identifier the
 * integrating screen picks (e.g. 'students_list'); pass a falsy reportKey to
 * skip fetching (e.g. before the screen knows what to key its export by).
 */
export function useExportTemplates(reportKey: string | undefined) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;

  const cacheKey = user && reportKey
    ? ['export-templates', user.id, campusId, reportKey]
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const response = await exportTemplatesApi.getExportTemplates(reportKey!, campusId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch export templates');
      }
      return response.data || [];
    },
    {
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const templates = data || [];
  const defaultTemplate = templates.find(t => t.is_default) ?? null;

  const createTemplate = async (dto: CreateExportTemplateDTO) => {
    const response = await exportTemplatesApi.createExportTemplate(dto, campusId);
    if (!response.success) {
      throw new Error(response.error || 'Failed to create export template');
    }
    mutate();
    return response.data;
  };

  const updateTemplate = async (id: string, dto: UpdateExportTemplateDTO) => {
    const response = await exportTemplatesApi.updateExportTemplate(id, dto);
    if (!response.success) {
      throw new Error(response.error || 'Failed to update export template');
    }
    mutate();
    return response.data;
  };

  const deleteTemplate = async (id: string) => {
    const response = await exportTemplatesApi.deleteExportTemplate(id);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete export template');
    }
    mutate();
  };

  const setDefaultTemplate = async (id: string) => {
    const response = await exportTemplatesApi.setDefaultExportTemplate(id);
    if (!response.success) {
      throw new Error(response.error || 'Failed to set default export template');
    }
    mutate();
    return response.data;
  };

  return {
    templates,
    defaultTemplate,
    loading: isLoading,
    error: error?.message,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    refresh: mutate,
  };
}
