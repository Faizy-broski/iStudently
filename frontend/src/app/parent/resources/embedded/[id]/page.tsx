import EmbedResourceViewer from '@/components/embedded-resources/EmbedResourceViewer'

export default async function ParentEmbedViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EmbedResourceViewer id={id} />
}
