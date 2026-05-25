import VLabyPortal from '@/components/vlaby/VLabyPortal'
import { VLabySchoolConnect } from '@/components/vlaby/VLabySchoolConnect'

export const metadata = { title: 'Virtual Labs' }

export default function AdminVLabyPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <VLabySchoolConnect />
      <VLabyPortal basePath="/admin/resources/vlaby" />
    </div>
  )
}
