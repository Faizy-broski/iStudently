'use client'

import { AlbumList } from '@/components/fina/AlbumList'

export default function TeacherFinaAlbumsPage() {
  return <AlbumList basePath="/teacher/fina/albums" canCreate={true} />
}
