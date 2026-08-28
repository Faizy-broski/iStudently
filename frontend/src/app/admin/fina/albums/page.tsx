'use client'

import { AlbumList } from '@/components/fina/AlbumList'

export default function AdminFinaAlbumsPage() {
  return <AlbumList basePath="/admin/fina/albums" canCreate={true} />
}
