/**
 * Centralized API Configuration
 * All API URLs should be derived from NEXT_PUBLIC_API_URL environment variable
 * This ensures a single point of configuration change
 */

export const getApiUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://demo.istudent.ly/api';
  return baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
};

export const API_URL = getApiUrl();

export default {
  API_URL,
  getApiUrl,
};
