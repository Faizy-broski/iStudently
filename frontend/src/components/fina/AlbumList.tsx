'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2, Plus, FolderOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { listAlbums, createAlbum, type FinaAlbum } from '@/lib/api/fina-posts'

export function AlbumList({ basePath, canCreate }: { basePath: string; canCreate: boolean }) {
  const t = useTranslations('fina.media')
  const [albums, setAlbums] = useState<FinaAlbum[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => { listAlbums().then((res) => setAlbums(res.data ?? [])) }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await createAlbum({ title: newTitle.trim() })
      if (res.error) toast.error(res.error)
      else { setNewTitle(''); load() }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('page_title')}</h1>

      {canCreate && (
        <div className="flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('page_title')} />
          <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="gap-1.5 shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {albums === null ? (
        <Skeleton className="h-16 w-full" />
      ) : albums.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('pending_queue_empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {albums.map((album) => (
            <Link key={album.id} href={`${basePath}/${album.id}`}>
              <Card className="hover:bg-gray-50">
                <CardContent className="py-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">{album.title}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
