import VLabyExperimentViewer from '@/components/vlaby/VLabyExperimentViewer'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'Virtual Labs Experiment' }

export default async function TeacherVirtualLabsExperimentPage({ params }: Props) {
  const { id } = await params
  return (
    <VLabyExperimentViewer
      experimentId={id}
      backPath="/teacher/resources/virtual-labs"
    />
  )
}
