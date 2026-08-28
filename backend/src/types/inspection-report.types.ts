export type ReportStatus = 'pending_signatures' | 'fully_signed'
export type SignerRole = 'teacher' | 'principal' | 'inspector'

export interface InspectionReport {
  id: string
  evaluation_id: string
  visit_id: string
  school_id: string
  teacher_profile_id: string
  inspector_profile_id: string
  status: ReportStatus
  pdf_file_url: string | null
  generated_at: string | null
  fully_signed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface InspectionReportSignature {
  id: string
  report_id: string
  signer_role: SignerRole
  signer_profile_id: string
  typed_full_name: string
  attested_at: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
