// Staff qualifications: skills, education, certifications, languages (backend: human-resources.routes.ts;
// web: lib/api/human-resources.ts, QualificationsTab). Responses are { data, error } like the web's.
import type { ApiClient } from '../../client'

export type IlrLevel = 'ILR_Level_1' | 'ILR_Level_2' | 'ILR_Level_3' | 'ILR_Level_4' | 'ILR_Level_5'
export const ILR_LEVELS: IlrLevel[] = ['ILR_Level_1', 'ILR_Level_2', 'ILR_Level_3', 'ILR_Level_4', 'ILR_Level_5']

export interface HrSkill { id: string; profile_id: string; title: string; description?: string | null }
export interface HrEducation { id: string; profile_id: string; qualification: string; institute?: string | null; start_date?: string | null; completed_on?: string | null }
export interface HrCertification { id: string; profile_id: string; title: string; institute?: string | null; granted_on?: string | null; valid_through?: string | null }
export interface HrLanguage { id: string; profile_id: string; title: string; reading?: IlrLevel | null; speaking?: IlrLevel | null; writing?: IlrLevel | null }
export interface HrQualifications { skills: HrSkill[]; education: HrEducation[]; certifications: HrCertification[]; languages: HrLanguage[] }

export type HrKind = 'skills' | 'education' | 'certifications' | 'languages'

export function adminHumanResourcesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  type Input = Record<string, unknown> & { profile_id?: string; campus_id?: string | null }
  const crud = (kind: HrKind) => ({
    create: (input: Input) => api.post<unknown>(`/human-resources/${kind}`, input),
    update: (rowId: string, input: Input) => api.put<unknown>(`/human-resources/${kind}/${id(rowId)}`, input),
    remove: (rowId: string) => api.del<void>(`/human-resources/${kind}/${id(rowId)}`),
  })
  const [skills, education, certifications, languages] = (['skills', 'education', 'certifications', 'languages'] as const).map(crud)
  return {
    qualifications: (profileId: string) => api.get<HrQualifications>(`/human-resources/qualifications/${id(profileId)}`),
    createSkill: skills.create,
    updateSkill: skills.update,
    removeSkill: skills.remove,
    createEducation: education.create,
    updateEducation: education.update,
    removeEducation: education.remove,
    createCertification: certifications.create,
    updateCertification: certifications.update,
    removeCertification: certifications.remove,
    createLanguage: languages.create,
    updateLanguage: languages.update,
    removeLanguage: languages.remove,
  }
}
