'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { listActiveStories, type FinaStory } from '@/lib/api/fina-stories'
import { GatedMediaImage } from './GatedMediaImage'

/** Stories bar (spec §16.2) — horizontal row at the top of the wall.
 * Tapping a story opens it full-size; nothing more elaborate (auto-advance,
 * timed progress bars) — the spec itself deprioritizes stories as "the
 * impressive layer", not core to the pilot. */
export function StoriesBar() {
  const t = useTranslations('fina.stories')
  const [stories, setStories] = useState<FinaStory[] | null>(null)
  const [viewing, setViewing] = useState<FinaStory | null>(null)

  useEffect(() => { listActiveStories().then((res) => setStories(res.data ?? [])) }, [])

  if (stories === null || stories.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {stories.map((s) => (
        <button key={s.id} onClick={() => setViewing(s)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-[#022172] ring-offset-2">
            <GatedMediaImage mediaId={s.media_id} variant="thumb" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10px] text-gray-500 max-w-[60px] truncate">
            {[s.author?.first_name].filter(Boolean).join(' ') || t('story')}
          </span>
        </button>
      ))}

      <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null) }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {viewing && <GatedMediaImage mediaId={viewing.media_id} variant="lg" alt="" className="w-full h-auto" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
