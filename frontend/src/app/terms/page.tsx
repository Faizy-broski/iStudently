import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

export const generateMetadata = () => legalMetadata('terms')

export default function Page() {
  return <LegalDocument doc="terms" />
}
