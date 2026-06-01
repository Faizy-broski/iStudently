import EmbedResourceViewer from '@/components/embedded-resources/EmbedResourceViewer'

export default function TeacherEmbedViewPage({ params }: { params: { id: string } }) {
  return <EmbedResourceViewer id={params.id} />
}
