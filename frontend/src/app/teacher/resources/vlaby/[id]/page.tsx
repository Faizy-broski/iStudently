import VLabyExperimentViewer from '@/components/vlaby/VLabyExperimentViewer'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'VLaby Experiment' }

export default async function TeacherVLabyExperimentPage({ params }: Props) {
  const { id } = await params
  return (
    <VLabyExperimentViewer
      experimentId={id}
      backPath="/teacher/resources/vlaby"
      loginPath="/teacher/resources/vlaby"
    />
  )
}
