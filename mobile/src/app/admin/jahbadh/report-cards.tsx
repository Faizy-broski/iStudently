import { jgPdfPath, JG_REPORT_CARD_OPTION_KEYS, type JgReportCardOptions, type JgReportCardSettings, type JgScope } from '@studently/api-client';
import { decisionTone, fmtMark, fmtPct } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { EyeOff, Printer, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { chipTone, JgBlocked, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Report cards (web: /admin/jahbadh-grades/report-cards): scope, options, print range, publishing, preview. */
export default function JahbadhReportCards() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const cid = campusId ?? 'own';
  const [scope, setScope] = useState<JgScope>('final');
  const overview = useApi(sectionId ? (['jg', 'overview', sectionId, cid] as const) : null, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, c === 'own' ? null : c));
  const preview = useApi(sectionId ? (['jg', 'cards', sectionId, scope, cid] as const) : null, ([, , s, sc, c]) => jahbadhGrades.reportCards(s, sc, c === 'own' ? null : c));
  const settings = useApi(sectionId ? (['jg', 'rc-settings', sectionId, cid] as const) : null, ([, , s, c]) => jahbadhGrades.reportCardSettings(s, c === 'own' ? null : c));
  const pubs = useApi(sectionId ? (['jg', 'pubs', sectionId, cid] as const) : null, ([, , s, c]) => jahbadhGrades.publications(s, c === 'own' ? null : c));

  const [form, setForm] = useState<{ options: JgReportCardOptions; tips: string; quotes: string } | null>(null);
  const [seen, setSeen] = useState<JgReportCardSettings | null>(null);
  if (settings.data && settings.data !== seen) {
    setSeen(settings.data);
    setForm({ options: settings.data.options, tips: settings.data.guardian_tips.join('\n'), quotes: settings.data.quotes.join('\n') });
  }
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const ov = overview.data;
  const scopes: { value: JgScope; label: string }[] = [
    ...(ov?.rule.stage_names ?? []).map((n, i) => (n ? { value: `stage${i + 1}` as JgScope, label: n } : null)).filter((x): x is { value: JgScope; label: string } => !!x),
    { value: 'final', label: t('grades.finalResult') },
  ];
  const cards = preview.data?.cards ?? [];
  const fromN = Number(from) || 1;
  const toN = Number(to) || cards.length;
  const count = Math.max(0, Math.min(toN, cards.length) - Math.max(fromN, 1) + 1);
  const published = pubs.data?.find((p) => p.scope === scope);

  const share = async (range: { from?: number; to?: number }) => {
    const sid = sectionId;
    if (!sid) return;
    setBusy(true);
    try {
      await shareApiFile(jgPdfPath.reportCards(sid, scope, range, campusId), `report-cards-${scope}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  };
  const togglePublish = async () => {
    const sid = sectionId;
    if (!sid) return;
    const pubId = published?.id ?? null;
    const res = pubId ? await jahbadhGrades.unpublish(sid, pubId, campusId) : await jahbadhGrades.publish(sid, scope, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(pubId ? t('grades.unpublished') : t('grades.published'));
    pubs.mutate(res.data, { revalidate: false });
  };
  const saveSettings = async () => {
    const sid = sectionId;
    if (!sid || !form) return;
    const res = await jahbadhGrades.saveReportCardSettings(
      sid,
      { options: form.options, guardian_tips: form.tips.split('\n').map((x) => x.trim()).filter(Boolean), quotes: form.quotes.split('\n').map((x) => x.trim()).filter(Boolean) },
      campusId,
    );
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    settings.mutate(res.data, { revalidate: false });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('grades.reportCards') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {overview.error ? (
          <JgBlocked error={overview.error} isAdmin={isAdmin} />
        ) : !ov ? (
          sectionId ? <Skeleton className="h-64 rounded-2xl" /> : null
        ) : (
          <>
            <FormSection title={t('grades.printCards')} description={`${ov.rule.name} — ${ov.section.name}`}>
              <Picker value={scope} onChange={(v) => setScope(v as JgScope)} options={scopes} />
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1">
                  <Text variant="muted" className="text-xs">{t('grades.fromNumber')}</Text>
                  <Input keyboardType="number-pad" placeholder="1" value={from} onChangeText={setFrom} />
                </View>
                <View className="flex-1 gap-1">
                  <Text variant="muted" className="text-xs">{t('grades.toNumber')}</Text>
                  <Input keyboardType="number-pad" placeholder={String(cards.length || '')} value={to} onChangeText={setTo} />
                </View>
              </View>
              <Text variant="muted" className="text-sm">{t('grades.cardsToPrint', { count })}</Text>
              <Button disabled={!count || busy} onPress={() => share({ from: from ? fromN : undefined, to: to ? toN : undefined })}>
                <Icon as={Printer} className="text-primary-foreground size-4" />
                <Text>{t('grades.printPdf')}</Text>
              </Button>
            </FormSection>

            {isAdmin ? (
              <FormSection title={t('grades.publishing')} description={t('grades.publishingHint')}>
                {scopes.map((s) => {
                  const p = pubs.data?.find((x) => x.scope === s.value);
                  return (
                    <View key={s.value} className="flex-row items-center justify-between">
                      <Text className="text-sm">{s.label}</Text>
                      <StatusChip label={p ? t('grades.publishedOn', { date: new Date(p.published_at).toLocaleDateString(locale) }) : t('grades.notPublished')} tone={p ? 'success' : 'muted'} />
                    </View>
                  );
                })}
                <Button variant={published ? 'outline' : 'default'} onPress={togglePublish}>
                  <Icon as={published ? EyeOff : Send} className={published ? 'text-foreground size-4' : 'text-primary-foreground size-4'} />
                  <Text>{published ? t('grades.unpublishScope') : t('grades.publishScope')}</Text>
                </Button>
              </FormSection>
            ) : null}

            <Panel>
              {!preview.data ? (
                <Skeleton className="m-4 h-40 rounded-2xl" />
              ) : (
                cards.map((c, i) => (
                  <Pressable
                    key={c.student.listNumber}
                    onPress={() => share({ from: c.student.listNumber, to: c.student.listNumber })}
                    accessibilityRole="button"
                    className={i < cards.length - 1 ? 'border-info-soft dark:border-border gap-1.5 border-b px-4 py-3 active:opacity-70' : 'gap-1.5 px-4 py-3 active:opacity-70'}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`${c.student.listNumber}. ${c.student.name}`}</Text>
                      <Icon as={Printer} className="text-muted-foreground size-4" />
                    </View>
                    <Text variant="muted" className="text-[11px]">
                      {`${c.total === null ? '—' : `${fmtMark(c.total)} / ${fmtMark(c.max)}`} · ${fmtPct(c.pct, 1) || '—'}${c.estimate ? ` · ${c.estimate}` : ''}${c.rank ? ` · ${t('grades.rank')} ${c.rank}` : ''}`}
                    </Text>
                    <StatusChip label={c.decision} tone={chipTone(decisionTone(c.decision))} className="self-start" />
                  </Pressable>
                ))
              )}
            </Panel>

            {form ? (
              <FormSection title={t('grades.cardOptions')}>
                {JG_REPORT_CARD_OPTION_KEYS.map((k) => (
                  <View key={k} className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm">{t(`grades.opt_${k}`)}</Text>
                    <Switch checked={form.options[k]} onCheckedChange={(v) => setForm({ ...form, options: { ...form.options, [k]: v } })} />
                  </View>
                ))}
                <Text variant="muted" className="text-xs">{t('grades.guardianTips')}</Text>
                <Input multiline value={form.tips} onChangeText={(v) => setForm({ ...form, tips: v })} />
                <Text variant="muted" className="text-xs">{`${t('grades.quotes')} — ${t('grades.onePerLine')}`}</Text>
                <Input multiline value={form.quotes} onChangeText={(v) => setForm({ ...form, quotes: v })} />
                <Button variant="outline" onPress={saveSettings}>
                  <Text>{t('grades.save')}</Text>
                </Button>
              </FormSection>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}
