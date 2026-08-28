'use client'

import { useParams } from 'next/navigation'
import { AlbumViewer } from '@/components/fina/AlbumViewer'

export default function TeacherFinaAlbumDetailPage() {
  const params = useParams<{ id: string }>()
  return <AlbumViewer albumId={params.id} />
}
