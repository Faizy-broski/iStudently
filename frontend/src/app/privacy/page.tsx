import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

export const generateMetadata = () => legalMetadata('privacy')

export default function Page() {
  return <LegalDocument doc="privacy" />
}
