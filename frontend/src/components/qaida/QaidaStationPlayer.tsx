'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Volume2, X, RotateCcw, Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { buildQuestions, reviewQuestions, type Question } from '@/lib/qaida/activities';
import type { Station } from '@/lib/qaida/content';
import { say, stopSpeech, sfx, unlockAudio, loadAudioPack } from '@/lib/qaida/audio';
import { useQaidaProgress } from '@/hooks/useQaidaProgress';
import { QaidaGlyph } from './QaidaGlyph';
import { QaidaResult } from './QaidaResult';

type Answered = { key: string; correct: boolean };

export interface StationPlayerProps {
  station: Station;
  worldId: string;
  questionCount?: number;
  reviewKeys?: string[];          // إن مُرِّرت، فهي جلسة مراجعة
  soundOn?: boolean;
  speechOn?: boolean;
  onExit: () => void;
}

export function QaidaStationPlayer({
  station, worldId, questionCount = 10, reviewKeys, soundOn = true, speechOn = true, onExit,
}: StationPlayerProps) {
  const t = useTranslations('qaida.play');
  const { submit } = useQaidaProgress();

  const isReview = Boolean(reviewKeys?.length);
  const questions = useMemo<Question[]>(
    () => (isReview ? reviewQuestions(reviewKeys!, 14) : buildQuestions(station, worldId, questionCount)),
    [station, worldId, questionCount, reviewKeys, isReview],
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hearts, setHearts] = useState(station.exam ? 3 : 5);
  const [chosen, setChosen] = useState<string[]>([]);     // ترتيب / بناء
  const [huntPicks, setHuntPicks] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Awaited<ReturnType<typeof submit>> | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());

  const q = questions[index];
  const maxHearts = station.exam ? 3 : 5;

  useEffect(() => { void loadAudioPack(); unlockAudio(); }, []);
  useEffect(() => () => stopSpeech(), []);

  /* ينطق السؤال تلقائياً عند ظهوره */
  useEffect(() => {
    if (q?.speak) void say(q.speak, { enabled: speechOn });
    return () => stopSpeech();
  }, [q, speechOn]);

  // No audio pack has ever been uploaded to public/qaida/audio/ for this
  // school (manifest.json 404 — expected, say() falls back to the browser's
  // speechSynthesis), so if this device/browser also has no Arabic TTS voice
  // installed, say() silently resolves false and Listen looks broken with no
  // indication why. Surfaced once per station instead of failing silently —
  // this only fires from an explicit Listen action (click/Space), never from
  // the auto-speak-on-question-change effect above, so it never interrupts
  // with a toast the student didn't ask for.
  const warnedNoVoiceRef = useRef(false);
  const listen = useCallback(() => {
    void say(q?.speak, { enabled: speechOn }).then((played) => {
      if (!played && speechOn && !warnedNoVoiceRef.current) {
        warnedNoVoiceRef.current = true;
        toast.error(t('noVoiceAvailable'));
      }
    });
  }, [q, speechOn, t]);

  const finish = useCallback(async (all: Answered[]) => {
    setSaving(true);
    const outcome = await submit({
      stationId: isReview ? null : station.id,
      worldId: isReview ? null : worldId,
      isReview,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      items: all,
    });
    setSaving(false);
    setDone(outcome);
    if (outcome && outcome.stars === 3) sfx.star(soundOn);
    else if (outcome && outcome.pct >= 70) sfx.levelUp(soundOn);
  }, [submit, isReview, station.id, worldId, soundOn]);

  const advance = useCallback((all: Answered[]) => {
    stopSpeech();
    setPicked(null); setRevealed(false); setChosen([]); setHuntPicks(new Set());
    if (index + 1 >= questions.length) void finish(all);
    else setIndex(i => i + 1);
  }, [index, questions.length, finish]);

  const judge = useCallback((correct: boolean) => {
    if (revealed) return;
    setRevealed(true);
    const next = [...answers, { key: q.key, correct }];
    setAnswers(next);
    if (correct) sfx.correct(soundOn);
    else { sfx.wrong(soundOn); setHearts(h => Math.max(0, h - 1)); }
  }, [revealed, answers, q, soundOn]);

  /* ----------------------------------------------- اختصارات لوحة المفاتيح */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Escape') { onExit(); e.preventDefault(); return; }
      if (e.key === ' ') { if (q?.speak) listen(); e.preventDefault(); return; }
      if (e.key === 'Enter') {
        document.querySelector<HTMLButtonElement>('[data-qaida-primary]')?.click();
        e.preventDefault(); return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        const btns = document.querySelectorAll<HTMLButtonElement>('[data-qaida-option]:not([disabled])');
        btns[n]?.click();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [q, speechOn, onExit, listen]);

  if (done) {
    return (
      <QaidaResult
        outcome={done}
        isReview={isReview}
        stationTitle={station.title}
        onRetry={() => { window.location.reload(); }}
        onExit={onExit}
      />
    );
  }

  if (!q) return null;

  const outOfHearts = hearts === 0 && revealed;

  /* ------------------------------------------------------------- العرض */
  return (
    <div className="mx-auto w-full max-w-3xl pb-32">
      {/* شريط الحالة */}
      <div className="flex items-center gap-3 py-3">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('exit')}>
          <X className="size-5" />
        </Button>
        <Progress value={(index / questions.length) * 100} className="flex-1" />
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {index + 1}/{questions.length}
        </span>
        <div className="flex gap-0.5" aria-label={t('hearts', { count: hearts })}>
          {Array.from({ length: maxHearts }).map((_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${i < hearts ? 'bg-[var(--qaida-ink-red)]' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <p className="py-3 text-center font-semibold leading-relaxed text-muted-foreground">{q.prompt}</p>

      {/* صحيفة القراءة */}
      {(q.display !== undefined || q.audioOnly || q.title) && (
        <Card className="relative mb-4 overflow-hidden border-[var(--qaida-frame)] bg-[var(--qaida-paper)] px-5 py-8 text-center">
          <span className="qaida-rule qaida-rule-top" aria-hidden />
          <span className="qaida-rule qaida-rule-bottom" aria-hidden />

          {q.title && (
            <div className="font-display text-2xl text-[var(--qaida-ink-red)]">{q.title}</div>
          )}

          {q.display !== undefined && (
            <QaidaGlyph text={q.display} mark={q.mark} size={q.small ? 'sm' : 'lg'} />
          )}

          {q.audioOnly && q.display === undefined && (
            <Volume2 className="mx-auto size-16 text-primary" aria-hidden />
          )}

          {q.speak && (
            <Button
              variant="outline"
              className="mt-2 rounded-full"
              onClick={() => { sfx.tap(soundOn); listen(); }}
            >
              <Volume2 className="size-4" /> {t('listen')}
            </Button>
          )}

          {q.facts && (
            <dl className="mt-4 grid gap-2 text-start">
              {q.facts.map(f => (
                <div key={f.label} className="flex gap-3 border-t border-border/60 pt-2 text-sm">
                  <dt className="min-w-16 font-bold text-[var(--qaida-ink-red)]">{f.label}</dt>
                  <dd className="font-scribe text-lg leading-loose text-muted-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}

      {/* الخيارات */}
      {q.mode === 'choice' && q.options && (
        <div className="grid grid-cols-2 gap-2.5">
          {q.options.map((o, i) => {
            const isAnswer = o.id === q.answer;
            const state = !revealed ? '' : isAnswer ? 'qaida-opt-right' : o.id === picked ? 'qaida-opt-wrong' : '';
            return (
              <button
                key={o.id}
                data-qaida-option
                disabled={revealed}
                onClick={() => { setPicked(o.id); judge(isAnswer); }}
                className={`qaida-opt ${o.big ? 'qaida-opt-big' : ''} ${state}`}
              >
                <span className="qaida-kbd" aria-hidden>{i + 1}</span>
                <span>{o.text}</span>
                {o.sub && <small className="font-scribe text-lg text-muted-foreground">{o.sub}</small>}
              </button>
            );
          })}
        </div>
      )}

      {/* صيد الحركة */}
      {q.mode === 'hunt' && q.tiles && (
        <div className="grid grid-cols-3 gap-2.5">
          {q.tiles.map(tile => {
            const on = huntPicks.has(tile.id);
            const state = !revealed ? (on ? 'qaida-opt-picked' : '')
              : tile.ok ? 'qaida-opt-right' : on ? 'qaida-opt-wrong' : '';
            return (
              <button
                key={tile.id}
                data-qaida-option
                disabled={revealed}
                onClick={() => {
                  sfx.tap(soundOn);
                  setHuntPicks(prev => {
                    const next = new Set(prev);
                    next.has(tile.id) ? next.delete(tile.id) : next.add(tile.id);
                    return next;
                  });
                }}
                className={`qaida-opt qaida-opt-big min-h-22 ${state}`}
              >
                {tile.text}
              </button>
            );
          })}
        </div>
      )}

      {/* الترتيب والبناء */}
      {(q.mode === 'order' || q.mode === 'build') && q.tiles && (
        <>
          <div className="mb-3 flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
            {chosen.length === 0 && (
              <span className="text-sm text-muted-foreground">{t('tapInOrder')}</span>
            )}
            {chosen.map(id => {
              const tile = q.tiles!.find(x => x.id === id)!;
              return (
                <button
                  key={id}
                  className="qaida-tile"
                  disabled={revealed}
                  onClick={() => { sfx.tap(soundOn); setChosen(c => c.filter(x => x !== id)); }}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {q.tiles.map(tile => (
              <button
                key={tile.id}
                data-qaida-option
                disabled={revealed || chosen.includes(tile.id)}
                onClick={() => { sfx.tap(soundOn); setChosen(c => [...c, tile.id]); }}
                className={`qaida-tile ${chosen.includes(tile.id) ? 'opacity-25' : ''}`}
              >
                {tile.text}
              </button>
            ))}
          </div>
        </>
      )}

      {/* التغذية الراجعة */}
      {revealed && (
        <div
          aria-live="polite"
          className={`mt-4 rounded-xl border p-4 text-sm leading-relaxed ${
            answers.at(-1)?.correct
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-destructive/50 bg-destructive/10'
          }`}
        >
          <b className="mb-1 block font-display">
            {answers.at(-1)?.correct ? t('correct') : t('tryAgain')}
          </b>
          {q.reveal && <div className="my-1.5 font-scribe text-2xl">{q.reveal}</div>}
          {q.note}
        </div>
      )}

      {/* شريط الإجراءات */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2.5">
          {outOfHearts ? (
            <>
              <Button variant="outline" className="flex-1" onClick={onExit}>{t('backToMap')}</Button>
              <Button className="flex-1" data-qaida-primary onClick={() => window.location.reload()}>
                <RotateCcw className="size-4" /> {t('retry')}
              </Button>
            </>
          ) : q.mode === 'learn' ? (
            <Button
              className="flex-1" data-qaida-primary disabled={saving}
              onClick={() => advance([...answers, { key: q.key, correct: true }])}
            >
              {t('next')} <ChevronLeft className="size-4" />
            </Button>
          ) : q.mode === 'read' ? (
            revealed ? (
              <Button className="flex-1" data-qaida-primary disabled={saving} onClick={() => advance(answers)}>
                {t('next')}
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={() => { listen(); judge(false); }}>
                  <RotateCcw className="size-4" /> {t('readAgain')}
                </Button>
                <Button className="flex-1" data-qaida-primary onClick={() => judge(true)}>
                  <Check className="size-4" /> {t('readCorrectly')}
                </Button>
              </>
            )
          ) : revealed ? (
            <Button className="flex-1" data-qaida-primary disabled={saving} onClick={() => advance(answers)}>
              {index + 1 >= questions.length ? t('finish') : t('next')}
            </Button>
          ) : q.mode === 'hunt' ? (
            <Button
              className="flex-1" data-qaida-primary
              onClick={() => {
                const right = q.tiles!.filter(x => x.ok).map(x => x.id);
                judge(right.length === huntPicks.size && right.every(r => huntPicks.has(r)));
              }}
            >
              {t('check')}
            </Button>
          ) : (q.mode === 'order' || q.mode === 'build') ? (
            <Button
              className="flex-1" data-qaida-primary
              disabled={chosen.length !== q.tiles!.length}
              onClick={() => {
                const ok = q.answerText
                  ? chosen.map(id => q.tiles!.find(x => x.id === id)!.text).join('') === q.answerText
                  : chosen.join(',') === (q.answerOrder ?? []).join(',');
                judge(ok);
              }}
            >
              {t('check')}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
          {t('keyboardHint')}
        </p>
      </div>
    </div>
  );
}
