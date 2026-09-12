'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Star, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { WORLDS, type Station } from '@/lib/qaida/content';
import { worldStats, worldUnlocked, stationUnlocked, type QaidaProgress } from '@/lib/qaida/progress';

/** سُلَّم القراءة: العوالم الثلاثة عشر ومحطاتها، بترتيب الفتح */
export function QaidaWorldMap({
  progress, onPlay,
}: {
  progress: QaidaProgress;
  onPlay: (worldId: string, station: Station) => void;
}) {
  const t = useTranslations('qaida');
  const firstOpen = WORLDS.findIndex((w, i) => worldUnlocked(progress, i) && !worldStats(progress, w).complete);
  const [open, setOpen] = useState<string | null>(WORLDS[Math.max(0, firstOpen)]?.id ?? null);

  return (
    <div className="space-y-3">
      {WORLDS.map((w, wi) => {
        const st = worldStats(progress, w);
        const unlocked = worldUnlocked(progress, wi);
        const isOpen = open === w.id;

        return (
          <Card key={w.id} className={`overflow-hidden ${unlocked ? '' : 'opacity-60 saturate-50'}`}>
            <button
              type="button"
              disabled={!unlocked}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : w.id)}
              className="flex w-full items-center gap-4 p-4 text-start"
            >
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-2xl border font-scribe text-3xl ${
                  st.complete ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted'
                }`}
                aria-hidden
              >
                {w.glyph}
              </span>

              <span className="flex-1">
                <span className="block font-display text-lg">{t(`worlds.${w.id}.title`)}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`worlds.${w.id}.subtitle`)} · {st.done}/{st.total}
                </span>
                <Progress value={st.pct} className="mt-2 h-1.5 w-48 max-w-[42vw]" />
              </span>

              <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                {st.stars} <Star className="size-4 fill-current" />
              </span>
              {unlocked
                ? <ChevronDown className={`size-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                : <Lock className="size-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <ul className="space-y-2 px-4 pb-4">
                {w.stations.map((s, si) => {
                  const rec = progress.stations[s.id];
                  const canPlay = stationUnlocked(progress, w, si);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={!canPlay}
                        onClick={() => onPlay(w.id, s)}
                        className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-start transition
                                   hover:border-primary disabled:pointer-events-none disabled:opacity-50"
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          rec?.stars ? 'bg-emerald-600 text-white'
                          : s.exam ? 'bg-amber-400 text-amber-950' : 'bg-muted'
                        }`}>
                          {s.exam ? '★' : si + 1}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{t(`stations.${s.id}`)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.exam ? t('station.exam') : rec?.best ? t('station.best', { pct: rec.best }) : t('station.notStarted')}
                          </span>
                        </span>
                        <span className="flex gap-0.5" aria-hidden>
                          {[0, 1, 2].map(i => (
                            <Star key={i} className={`size-4 ${i < (rec?.stars ?? 0) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`} />
                          ))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
