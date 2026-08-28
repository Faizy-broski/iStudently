'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getAlbumDetail, type FinaAlbum } from '@/lib/api/fina-posts'
import { GatedMediaImage } from './GatedMediaImage'

/** Spec §16.5: two tabs, opening on "my child's photos" first. Download
 * button is simply never rendered here — an absent action, not a disabled
 * one, per the spec's explicit "forbidden actions are absent, not
 * disabled" rule (nothing in this build offers a download at all yet). */
export function AlbumViewer({ albumId }: { albumId: string }) {
  const t = useTranslations('fina.media')
  const [album, setAlbum] = useState<FinaAlbum | null>(null)
  const [media, setMedia] = useState<{ id: string; kind: string; isMyChild: boolean }[] | null>(null)

  useEffect(() => {
    getAlbumDetail(albumId).then((res) => {
      setAlbum(res.data?.album ?? null)
      setMedia(res.data?.media ?? [])
    })
  }, [albumId])

  if (media === null) {
    return <div className="p-4 sm:p-6 max-w-4xl"><Skeleton className="h-64 w-full" /></div>
  }

  const myChildMedia = media.filter((m) => m.isMyChild)
  const hasMyChildTab = myChildMedia.length > 0

  const Grid = ({ items }: { items: typeof media }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {items.map((m) => (
        <div key={m.id} className="aspect-square rounded-md overflow-hidden bg-gray-50">
          <GatedMediaImage mediaId={m.id} variant="md" alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-4">
      {album && <h1 className="text-xl font-bold text-gray-900">{album.title}</h1>}

      {hasMyChildTab ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">{`${t('kind_image')} (${myChildMedia.length})`}</TabsTrigger>
            <TabsTrigger value="all">{`${t('kind_image')} (${media.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="mine"><Grid items={myChildMedia} /></TabsContent>
          <TabsContent value="all"><Grid items={media} /></TabsContent>
        </Tabs>
      ) : (
        <Grid items={media} />
      )}
    </div>
  )
}
