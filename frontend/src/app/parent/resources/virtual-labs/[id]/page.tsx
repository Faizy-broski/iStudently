import VLabyExperimentViewer from '@/components/vlaby/VLabyExperimentViewer'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'Virtual Labs Experiment' }

export default async function ParentVirtualLabsExperimentPage({ params }: Props) {
  const { id } = await params
  return (
    <VLabyExperimentViewer
      experimentId={id}
      backPath="/parent/resources/virtual-labs"
      loginPath="/parent/resources/virtual-labs"
    />
  )
}
