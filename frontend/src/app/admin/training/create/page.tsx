'use client'

import { useRouter } from 'next/navigation'
import { TrainingSessionFormModal } from '@/components/admin/training/TrainingSessionFormModal'

export default function CreateTrainingPage() {
  const router = useRouter()

  return (
    <div className="p-6">
      <TrainingSessionFormModal
        open={true}
        onClose={() => router.push('/admin/training')}
        onSaved={() => router.push('/admin/training')}
      />
    </div>
  )
}
