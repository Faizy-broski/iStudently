import { apiRequest } from './index'

export interface CredentialsResult {
  username: string
  plainPassword?: string
}

export async function regenerateCredentials(profileId: string) {
  return apiRequest<CredentialsResult>(`/credentials/${profileId}/regenerate`, {
    method: 'POST',
  })
}

export async function getUsername(profileId: string) {
  return apiRequest<{ username: string | null }>(`/credentials/${profileId}/username`)
}

export async function bulkAssignUsernames() {
  return apiRequest<{ assigned: number }>('/credentials/bulk-assign', {
    method: 'POST',
  })
}
