'use client'

import { useParams } from 'next/navigation'
import { AlbumViewer } from '@/components/fina/AlbumViewer'

export default function AdminFinaAlbumDetailPage() {
  const params = useParams<{ id: string }>()
  return <AlbumViewer albumId={params.id} />
}
