'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQaidaProgress } from '@/hooks/useQaidaProgress';
import { dueItems, rankIndex, nextRankXp } from '@/lib/qaida/progress';
import { WORLDS, type Station } from '@/lib/qaida/content';
import { QaidaWorldMap } from './QaidaWorldMap';
import { QaidaStationPlayer } from './QaidaStationPlayer';

type Active =
  | { kind: 'station'; worldId: string; station: Station }
  | { kind: 'review'; keys: string[] }
  | null;

export function QaidaClient() {
  const t = useTranslations('qaida');
  const { progress, isLoading, error } = useQaidaProgress();
  const [active, setActive] = useState<Active>(null);

  if (isLoading) {
    return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }
  if (error) {
    return <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">{t('loadError')}</p>;
  }

  if (active?.kind === 'station') {
    return (
      <QaidaStationPlayer
        station={active.station}
        worldId={active.worldId}
        onExit={() => setActive(null)}
      />
    );
  }

  if (active?.kind === 'review') {
    const reviewStation: Station = { id: 'review', title: t('review.title'), kind: 'letter_by_audio' };
    return (
      <QaidaStationPlayer
        station={reviewStation}
        worldId="review"
        reviewKeys={active.keys}
        onExit={() => setActive(null)}
      />
    );
  }

  const due = dueItems(progress, 99);
  const totalStations = WORLDS.reduce((a, w) => a + w.stations.length, 0);
  const doneStations = Object.values(progress.stations).filter(s => s.stars > 0).length;
  const next = nextRankXp(progress.xp);

  return (
    <>
      <section className="mb-6 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <p className="text-sm text-muted-foreground">
              {t('summary', { done: doneStations, total: totalStations })}
              {next !== null && ` · ${t('toNextRank', {
                points: next - progress.xp,
                rank: t(`ranks.${rankIndex(progress.xp) + 1}`),
              })}`}
            </p>
          </div>
          {due.length > 0 && (
            <Button onClick={() => setActive({ kind: 'review', keys: due.slice(0, 14) })}>
              <RefreshCw className="size-4" /> {t('review.cta', { count: due.length })}
            </Button>
          )}
        </div>
      </section>

      <QaidaWorldMap
        progress={progress}
        onPlay={(worldId, station) => setActive({ kind: 'station', worldId, station })}
      />
    </>
  );
}
