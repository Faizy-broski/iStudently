'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LETTERS, HARAKAT, COMPOSITES, MUQATTAAT, MUQATTAA_LETTERS, WORDS, byId, forms,
  FATHA,
} from '@/lib/qaida/content';
import { say, sfx, unlockAudio } from '@/lib/qaida/audio';

type Tab = 'letters' | 'forms' | 'composites' | 'muqattaat' | 'harakat' | 'tanween' | 'madd';
const TABS: Tab[] = ['letters', 'forms', 'composites', 'muqattaat', 'harakat', 'tanween', 'madd'];

interface Cell { t: string; say: string; sub?: string; wide?: boolean }

function cellsFor(tab: Tab): Cell[] {
  switch (tab) {
    case 'letters':
      return LETTERS.map(L => ({ t: L.c, say: L.name, sub: L.name }));
    case 'forms':
      return LETTERS.filter(L => L.joinAfter !== false).map(L => {
        const f = forms(L);
        return { t: `${f.initial} ${f.medial} ${f.final}`, say: L.name, sub: L.name, wide: true };
      });
    case 'composites':
      return COMPOSITES.map(g => ({
        t: g.map(id => byId[id].c).join(''),
        say: g.map(id => byId[id].name).join(' '),
        sub: g.map(id => byId[id].name).join(' '),
        wide: true,
      }));
    case 'muqattaat':
      return MUQATTAAT.map(m => ({
        t: m.t,
        say: m.letters.map(c => MUQATTAA_LETTERS[c].name).join(' '),
        sub: m.surah,
        wide: true,
      }));
    case 'harakat':
    case 'tanween': {
      const set = tab === 'harakat' ? HARAKAT.slice(0, 3) : HARAKAT.slice(3, 6);
      return LETTERS.filter(L => L.id !== 'alif')
        .flatMap(L => set.map(h => ({ t: L.c + h.mark, say: L.c + h.mark })));
    }
    case 'madd':
      return [...WORDS.madd_alif.slice(0, 8), ...WORDS.madd_waw.slice(0, 8),
              ...WORDS.madd_ya.slice(0, 8), ...WORDS.leen.slice(0, 8)]
        .map(w => ({ t: w, say: w, wide: true }));
  }
}

export function QaidaBoard({ title }: { title: string }) {
  const router = useRouter();
  const t = useTranslations('qaida.board');
  const [tab, setTab] = useState<Tab>('letters');
  const [lit, setLit] = useState<number | null>(null);
  const [big, setBig] = useState(false);

  const cells = useMemo(() => cellsFor(tab), [tab]);
  const wide = cells[0]?.wide;

  return (
    <div className="min-h-dvh p-4" onPointerDown={unlockAudio}>
      <header className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t('exit')} onClick={() => router.push('/resources/qaida')}>
          <X className="size-5" />
        </Button>
        <nav className="flex flex-1 flex-wrap gap-1.5 rounded-xl bg-muted p-1.5">
          {TABS.map(x => (
            <button
              key={x}
              onClick={() => { sfx.tap(); setTab(x); setLit(null); }}
              aria-current={tab === x}
              className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${
                tab === x ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t(`tab.${x}`)}
            </button>
          ))}
        </nav>
        <Button variant="ghost" size="icon" aria-label={t('zoom')} onClick={() => setBig(b => !b)}>
          <Maximize2 className="size-5" />
        </Button>
      </header>

      <h1 className="sr-only">{title}</h1>

      <ul
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${
            wide ? (big ? 300 : 190) : (big ? 170 : 96)
          }px, 1fr))`,
        }}
      >
        {cells.map((c, i) => (
          <li key={i}>
            <button
              onClick={() => { setLit(i); sfx.tap(); void say(c.say); }}
              className={`flex min-h-26 w-full flex-col items-center justify-center gap-1 rounded-2xl border p-3 transition ${
                lit === i ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary'
              }`}
            >
              <span className={`font-scribe font-bold leading-normal ${
                big ? 'text-[clamp(3.5rem,7vw,6rem)]' : 'text-[clamp(2.4rem,5vw,3.9rem)]'
              }`}>
                {c.t}
              </span>
              {c.sub && <span className="text-xs opacity-80">{c.sub}</span>}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t('hint')}</p>
    </div>
  );
}
