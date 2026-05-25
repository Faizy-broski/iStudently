import VLabyPortal from '@/components/vlaby/VLabyPortal'

export const metadata = { title: 'Virtual Labs' }

export default function StudentVLabyPage() {
  return <VLabyPortal basePath="/student/resources/vlaby" />
}
