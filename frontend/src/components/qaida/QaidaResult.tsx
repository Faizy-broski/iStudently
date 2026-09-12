'use client';

import { useTranslations } from 'next-intl';
import { Star, Map, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { FinishOutcome } from '@/lib/qaida/progress';

export function QaidaResult({
  outcome, isReview, stationTitle, onRetry, onExit,
}: {
  outcome: FinishOutcome | null;
  isReview: boolean;
  stationTitle: string;
  onRetry: () => void;
  onExit: () => void;
}) {
  const t = useTranslations('qaida.result');
  if (!outcome) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-destructive">{t('saveFailed')}</p>
        <Button className="mt-4" onClick={onExit}>{t('backToMap')}</Button>
      </div>
    );
  }

  const verdict =
    outcome.pct >= 95 ? 'mastered' : outcome.pct >= 85 ? 'excellent'
    : outcome.pct >= 70 ? 'passed' : 'review';

  return (
    <div className="mx-auto max-w-xl p-4 pb-24 text-center">
      <h2 className="font-display text-2xl">{stationTitle}</h2>

      {!isReview && (
        <div className="my-5 flex justify-center gap-3" aria-label={t('stars', { count: outcome.stars })}>
          {[0, 1, 2].map(i => (
            <Star
              key={i}
              className={`size-14 transition-transform ${
                i < outcome.stars
                  ? 'fill-amber-400 text-amber-400 motion-safe:animate-in motion-safe:zoom-in'
                  : 'fill-muted text-muted'
              }`}
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </div>
      )}

      <p className="text-muted-foreground">{t(`verdict.${verdict}`)}</p>

      <div className="my-5 grid grid-cols-3 gap-2.5">
        <Card className="p-4"><b className="block font-display text-2xl text-primary">{outcome.pct}%</b>
          <small className="text-xs text-muted-foreground">{t('accuracy')}</small></Card>
        <Card className="p-4"><b className="block font-display text-2xl text-primary">+{outcome.gained}</b>
          <small className="text-xs text-muted-foreground">{t('points')}</small></Card>
        <Card className="p-4"><b className="block font-display text-2xl text-primary">{outcome.newBadges.length}</b>
          <small className="text-xs text-muted-foreground">{t('newBadges')}</small></Card>
      </div>

      {outcome.newBadges.length > 0 && (
        <Card className="mb-4 border-amber-400/50 bg-amber-400/10 p-4">
          <b className="text-amber-600 dark:text-amber-400">{t('badgesEarned')}</b>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {outcome.newBadges.map(b => (
              <li key={b} className="rounded-full bg-background px-3 py-1 text-sm font-semibold">
                {t(`badge.${b}`)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-center gap-2.5">
        <Button variant="outline" onClick={onRetry}><RotateCcw className="size-4" /> {t('retry')}</Button>
        <Button onClick={onExit}><Map className="size-4" /> {t('backToMap')}</Button>
      </div>
    </div>
  );
}
