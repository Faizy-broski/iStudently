import VLabyPortal from '@/components/vlaby/VLabyPortal'

export const metadata = { title: 'Virtual Labs' }

export default function StudentVirtualLabsPage() {
  return <VLabyPortal basePath="/student/resources/virtual-labs" />
}
