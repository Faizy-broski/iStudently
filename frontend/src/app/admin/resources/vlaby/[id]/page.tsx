import VLabyExperimentViewer from '@/components/vlaby/VLabyExperimentViewer'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'VLaby Experiment' }

export default async function AdminVLabyExperimentPage({ params }: Props) {
  const { id } = await params
  return (
    <VLabyExperimentViewer
      experimentId={id}
      backPath="/admin/resources/vlaby"
      loginPath="/admin/resources/vlaby"
    />
  )
}
