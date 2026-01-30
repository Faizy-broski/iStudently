import { getAuthToken } from './schools';
import { API_URL } from '@/config/api';

// Helper function for API requests
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Template interfaces
export interface TemplateField {
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

export interface TemplateConfig {
  fields: TemplateField[];
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
    data: string;
  };
}

export interface IdCardTemplate {
  id: string;
  campus_id: string;
  name: string;
  description: string;
  user_type: 'student' | 'teacher' | 'staff';
  template_config: TemplateConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface GeneratedIdCard extends IdCardTemplate {
  user_data: Record<string, any>;
}

// Get all templates for current school
export const getTemplates = async (userType?: string) => {
  const params = userType ? `?user_type=${userType}` : '';
  return apiRequest(`/id-card-templates${params}`);
};

// Get active template for a user type
export const getActiveTemplate = async (userType: string) => {
  return apiRequest(`/id-card-templates/active/${userType}`);
};

// Get template by ID
export const getTemplateById = async (id: string) => {
  return apiRequest(`/id-card-templates/${id}`);
};

// Create new template
export const createTemplate = async (data: {
  name: string;
  description?: string;
  user_type: 'student' | 'teacher' | 'staff';
  template_config: TemplateConfig;
}) => {
  return apiRequest('/id-card-templates', {
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
    template_config?: TemplateConfig;
  }
) => {
  return apiRequest(`/id-card-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// Set template as active
export const setActiveTemplate = async (id: string) => {
  return apiRequest(`/id-card-templates/${id}/activate`, {
    method: 'PUT',
  });
};

// Delete template
export const deleteTemplate = async (id: string) => {
  return apiRequest(`/id-card-templates/${id}`, {
    method: 'DELETE',
  });
};

// Get available tokens for a user type
export const getAvailableTokens = async (userType: string) => {
  return apiRequest(`/id-card-templates/tokens/${userType}`);
};

// Generate ID cards
export const generateStudentIdCard = async () => {
  return apiRequest('/id-card-templates/generate/student');
};

export const generateTeacherIdCard = async (teacherId: string) => {
  return apiRequest(`/id-card-templates/generate/teacher?teacher_id=${teacherId}`);
};

export const generateStaffIdCard = async (staffId: string) => {
  return apiRequest(`/id-card-templates/generate/staff?staff_id=${staffId}`);
};

// Preview template with sample data
export const previewTemplate = async (data: {
  template_config: TemplateConfig;
  user_type: 'student' | 'teacher' | 'staff';
}) => {
  return apiRequest('/id-card-templates/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
