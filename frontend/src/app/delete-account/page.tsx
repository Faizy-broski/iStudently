import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

export const generateMetadata = () => legalMetadata('deleteAccount')

export default function Page() {
  return <LegalDocument doc="deleteAccount" />
}
