import { getAuthToken } from './schools';
import { API_URL } from '@/config/api';
import { getImpersonationHeaders } from './abortable-fetch';

// Helper function for API requests
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...getImpersonationHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'API request failed');
  }

  return response.json();
}

export type CertificateRecipientType = 'student' | 'teacher' | 'staff';

export interface CertificateTemplateField {
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
}

export interface CertificateTemplateConfig {
  fields: CertificateTemplateField[];
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

export interface CertificateTemplate {
  id: string;
  campus_id: string;
  name: string;
  description?: string;
  recipient_type: CertificateRecipientType;
  occasion: string;
  template_config: CertificateTemplateConfig;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CertificateAvailableToken {
  token: string;
  label: string;
}

// Get all templates for current campus, optionally filtered by recipient type
export const getTemplates = async (recipientType?: CertificateRecipientType) => {
  const params = recipientType ? `?recipient_type=${recipientType}` : '';
  return apiRequest<{ templates: CertificateTemplate[] }>(`/certificate-templates${params}`);
};

// Get template by ID
export const getTemplateById = async (id: string) => {
  return apiRequest<{ template: CertificateTemplate }>(`/certificate-templates/${id}`);
};

// Create new template
export const createTemplate = async (data: {
  name: string;
  description?: string;
  recipient_type: CertificateRecipientType;
  occasion?: string;
  template_config: CertificateTemplateConfig;
}) => {
  return apiRequest<{ template: CertificateTemplate }>('/certificate-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// Update template
export const updateTemplate = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    occasion?: string;
    template_config?: CertificateTemplateConfig;
  }
) => {
  return apiRequest<{ template: CertificateTemplate }>(`/certificate-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// Duplicate template (used to turn a ready-made design into an editable copy)
export const duplicateTemplate = async (id: string) => {
  return apiRequest<{ template: CertificateTemplate }>(`/certificate-templates/${id}/duplicate`, {
    method: 'POST',
  });
};

// Delete template
export const deleteTemplate = async (id: string) => {
  return apiRequest<{ message: string }>(`/certificate-templates/${id}`, {
    method: 'DELETE',
  });
};

// Get available tokens for a recipient type
export const getAvailableTokens = async (recipientType: CertificateRecipientType) => {
  return apiRequest<{ tokens: CertificateAvailableToken[] }>(`/certificate-templates/tokens/${recipientType}`);
};

// Preview template with sample data
export const previewTemplate = async (data: {
  template_config: CertificateTemplateConfig;
  recipient_type: CertificateRecipientType;
}) => {
  return apiRequest<{ template_config: CertificateTemplateConfig; sample_data: Record<string, any> }>(
    '/certificate-templates/preview',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
};
