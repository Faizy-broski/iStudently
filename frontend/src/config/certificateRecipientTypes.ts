import {
  UserCircle,
  Users,
  Briefcase,
  BookOpen,
  HeartHandshake,
  Megaphone,
  Landmark,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { CertificateRecipientType } from '@/lib/api/certificate-template'

export interface CertificateRecipientTypeOption {
  value: CertificateRecipientType
  label: string
  icon: LucideIcon
}

// Every recipient type the Certificate Builder supports, each backed by a real per-campus
// roster (see backend/src/services/certificate-template.service.ts for the full rationale on
// why super_admin/inspector/financial_admin are not in this list).
export const CERTIFICATE_RECIPIENT_TYPES: CertificateRecipientTypeOption[] = [
  { value: 'student', label: 'Students', icon: UserCircle },
  { value: 'teacher', label: 'Teachers', icon: Users },
  { value: 'staff', label: 'Staff', icon: Briefcase },
  { value: 'librarian', label: 'Librarians', icon: BookOpen },
  { value: 'counselor', label: 'Counselors', icon: HeartHandshake },
  { value: 'media_officer', label: 'Media Officers', icon: Megaphone },
  { value: 'fina_supervisor', label: 'Financial Supervisors', icon: Landmark },
  { value: 'admin', label: 'Admins', icon: ShieldCheck },
  { value: 'parent', label: 'Parents', icon: UsersRound },
]

export function getCertificateRecipientTypeOption(value: string): CertificateRecipientTypeOption | undefined {
  return CERTIFICATE_RECIPIENT_TYPES.find((t) => t.value === value)
}
