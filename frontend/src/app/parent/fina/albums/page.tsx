'use client'

import { AlbumList } from '@/components/fina/AlbumList'

export default function ParentFinaAlbumsPage() {
  return <AlbumList basePath="/parent/fina/albums" canCreate={false} />
}
