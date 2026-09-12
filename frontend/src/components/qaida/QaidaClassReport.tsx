'use client';

import useSWR from 'swr';
import { API_URL } from '@/config/api';
import { useTranslations } from 'next-intl';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { WORLDS } from '@/lib/qaida/content';

interface Row {
  profileId: string; name: string; gradeLevelName: string | null; sectionName: string | null;
  xp: number; rankIndex: number; done: number; totalStations: number; stars: number;
  accuracy: number; minutes: number; graduated: boolean; lastActiveAt: string | null;
}

import { getAuthToken } from '@/lib/api/schools';

const fetcher = async (u: string) => {
  const token = await getAuthToken();
  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  return json.success !== undefined && json.data !== undefined ? json.data : json;
};

export function QaidaClassReport() {
  const t = useTranslations('qaida.report');
  const { data, isLoading } = useSWR<{ students: Row[]; worldCompletion: { id: string; completed: number }[]; classSize: number }>(
    `${API_URL}/qaida/report`, fetcher,
  );

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  const rows = data?.students ?? [];
  const size = data?.classSize ?? 0;

  const avgAcc = size ? Math.round(rows.reduce((a, r) => a + r.accuracy, 0) / size) : 0;
  const avgDone = size ? Math.round(rows.reduce((a, r) => a + r.done, 0) / size) : 0;
  const minutes = rows.reduce((a, r) => a + r.minutes, 0);

  const exportCsv = () => {
    const head = [t('col.name'), t('col.grade'), t('col.section'), t('col.xp'),
                  t('col.done'), t('col.stars'), t('col.accuracy'), t('col.minutes'), t('col.graduated')];
    const lines = [head.join(',')].concat(rows.map(r => [
      `"${r.name.replace(/"/g, '""')}"`, r.gradeLevelName ?? '', r.sectionName ?? '',
      r.xp, r.done, r.stars, r.accuracy, r.minutes, r.graduated ? '1' : '0',
    ].join(',')));
    // BOM ليفتح إكسل العربية بترميز صحيح
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qaida-class-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><b className="block font-display text-2xl">{size}</b>
          <small className="text-xs text-muted-foreground">{t('stat.students')}</small></Card>
        <Card className="p-4"><b className="block font-display text-2xl">{avgAcc}%</b>
          <small className="text-xs text-muted-foreground">{t('stat.avgAccuracy')}</small></Card>
        <Card className="p-4"><b className="block font-display text-2xl">{avgDone}</b>
          <small className="text-xs text-muted-foreground">{t('stat.avgStations')}</small></Card>
        <Card className="p-4"><b className="block font-display text-2xl">{minutes}</b>
          <small className="text-xs text-muted-foreground">{t('stat.minutes')}</small></Card>
      </div>

      <Card className="mb-5 overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-xs text-muted-foreground">
              <th className="p-2 text-start">{t('col.name')}</th>
              <th className="p-2 text-start">{t('col.rank')}</th>
              <th className="p-2 text-start">{t('col.xp')}</th>
              <th className="p-2 text-start">{t('col.done')}</th>
              <th className="p-2 text-start">{t('col.stars')}</th>
              <th className="p-2 text-start">{t('col.accuracy')}</th>
              <th className="p-2 text-start">{t('col.minutes')}</th>
              <th className="p-2 text-start">{t('col.graduated')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.profileId} className="border-b last:border-0">
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{t(`rank.${r.rankIndex}`)}</td>
                <td className="p-2 tabular-nums">{r.xp}</td>
                <td className="p-2">
                  <span className="tabular-nums">{r.done}/{r.totalStations}</span>
                  <Progress value={(r.done / r.totalStations) * 100} className="mt-1 h-1.5" />
                </td>
                <td className="p-2 tabular-nums">{r.stars}</td>
                <td className="p-2 tabular-nums">{r.accuracy}%</td>
                <td className="p-2 tabular-nums">{r.minutes}</td>
                <td className="p-2">{r.graduated ? '✓' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t('empty')}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mb-5 p-4">
        <h2 className="mb-3 font-display">{t('worldProgress')}</h2>
        {WORLDS.map(w => {
          const n = data?.worldCompletion.find(x => x.id === w.id)?.completed ?? 0;
          const pct = size ? Math.round((n / size) * 100) : 0;
          return (
            <div key={w.id} className="mb-3">
              <div className="mb-1 flex justify-between text-sm">
                <b>{t(`worlds.${w.id}`)}</b>
                <span className="text-muted-foreground">{n}/{size} · {pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </Card>

      <div className="flex flex-wrap gap-2.5 print:hidden">
        <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> {t('exportCsv')}</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> {t('print')}</Button>
      </div>
    </>
  );
}
