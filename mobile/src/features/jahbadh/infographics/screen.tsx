import { jahbadhInsightApi } from '@studently/api-client';
import { JG_INFOGRAPHIC_REPORTS, studentCard } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { FileDown, Maximize2, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { JgBlocked, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { api, jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

import { captureBase64, settle, shareImage, sharePagesPdf } from './export';
import { availability, buildPages, type BuiltPage, type PageCtx } from './pages';
import { PAGE_H, PAGE_W, type PageMeta } from './palette';

const insight = jahbadhInsightApi(api);
const GROUPS = ['subject', 'class', 'student'] as const;
const PREVIEW_STEP = 6;

/** «إنفوجرافيك جهبذ» (brief B6-62; web: /admin|teacher/jahbadh-grades/infographics). */
export function InfographicsScreen() {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  return (
    <>
      <Stack.Screen options={{ title: t('grades.infographics') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {sectionId ? <Body sectionId={sectionId} cid={campusId ?? 'own'} /> : null}
      </ScrollView>
    </>
  );
}

function Body({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const [scope, setScope] = useState('final');
  const [compare, setCompare] = useState<string | null>(null);
  const [subjectPick, setSubjectPick] = useState<string | null>(null);
  const [measurePick, setMeasurePick] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set(['card']));
  const [names, setNames] = useState(true);
  const [logo, setLogo] = useState(true);
  const [pickStudents, setPickStudents] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [shown, setShown] = useState(PREVIEW_STEP);
  const [stage, setStage] = useState<BuiltPage | null>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [viewer, setViewer] = useState<BuiltPage | null>(null);
  const stageRef = useRef<View>(null);

  const info = useApi(
    ['jg', 'inf', sectionId, cid, scope, compare ?? ''] as const,
    ([, , s, c, sc, cmp]) => insight.infographics(s, sc, cmp || null, c === 'own' ? null : c),
    { keepPreviousData: true },
  );
  const overview = useApi(['jg', 'overview', sectionId, cid] as const, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, c === 'own' ? null : c));

  const data = info.data;
  const M = data?.model;
  const subject = M?.subjects.find((s) => s.id === subjectPick) ?? M?.subjects[0];
  const measure = subject?.measures.find((m) => m.key === measurePick) ?? subject?.measures[0];

  const o = overview.data;
  const h = o?.settings.header ?? {};
  const meta: PageMeta = {
    school: h.school_name ?? '',
    office: h.education_office ?? '',
    municipality: h.municipality ?? '',
    year: o?.academic_year.name ?? '',
    teacher: h.homeroom_teacher ?? '',
    principal: h.principal ?? '',
    grade: o?.section.grade_level_name ?? '',
    section: o?.section.name ?? '',
  };
  const logoAvailable = !!h.logo_url;

  if (info.error && !data) return <JgBlocked error={info.error} isAdmin={isAdmin} />;
  if (!data || !M || !subject) return <Skeleton className="h-64 rounded-2xl" />;

  const ctx: PageCtx = { M, meta, opts: { names, logoUrl: logo && logoAvailable ? (h.logo_url as string) : null }, subjectId: subject.id, measureKey: measure?.key, cmp: data.compare ?? null };
  const avail = availability(ctx);
  const selected = new Set(JG_INFOGRAPHIC_REPORTS.filter((r) => !off.has(r.id) && avail[r.id] !== false).map((r) => r.id as string));
  const withCard = M.students.map((_, i) => i).filter((i) => M.students[i].name && studentCard(M, i));
  const studentIdx = pickStudents && picked ? withCard.filter((i) => picked.includes(String(i))) : withCard;
  const pages = buildPages(ctx, selected, studentIdx);
  const fileBase = `${meta.grade} ${meta.section} ${M.scopeTitle}`.trim();
  const note = (id: string) => (id === 'branches' ? t('grades.infNoBranches') : id === 'compare' ? t('grades.infNoCompare') : id === 'attendance' ? t('grades.infNoAttendance') : '');
  const err = (e: unknown) => toast.error(e instanceof Error ? (e.message === 'print-unavailable' ? t('app.pr_rebuild') : e.message) : t('app.error_title'));

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Mounts one page offscreen at full size, captures it, and unmounts it again (only one page is ever mounted). */
  async function render(page: BuiltPage, format: 'png' | 'jpg', scale: number, quality: number) {
    setStage(page);
    await settle();
    try {
      return await captureBase64(stageRef, format, scale, quality);
    } finally {
      setStage(null);
    }
  }
  async function shareOne(page: BuiltPage) {
    if (busy) return;
    setBusy({ done: 0, total: 1 });
    try {
      await shareImage(page.file, await render(page, 'png', 2, 1));
    } catch (e) {
      err(e);
    } finally {
      setBusy(null);
    }
  }
  async function shareAllPdf() {
    if (busy || !pages.length) return;
    setBusy({ done: 0, total: pages.length });
    try {
      const jpegs: string[] = [];
      for (const p of pages) {
        jpegs.push(await render(p, 'jpg', 1.5, 0.88));
        setBusy({ done: jpegs.length, total: pages.length });
      }
      await sharePagesPdf(fileBase, jpegs);
    } catch (e) {
      err(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <FormSection title={t('grades.infData')}>
        <View className="gap-1.5">
          <Label>{t('grades.infPeriod')}</Label>
          <Picker
            value={scope}
            onChange={(v) => {
              setScope(v);
              if (compare === v) setCompare(null);
            }}
            options={data.scopes.map((s) => ({ value: s.value, label: s.title }))}
          />
        </View>
        <View className="gap-1.5">
          <Label>{t('grades.infCompareWith')}</Label>
          <Picker
            value={compare ?? 'none'}
            onChange={(v) => setCompare(v === 'none' ? null : v)}
            options={[{ value: 'none', label: t('grades.infCompareNone') }, ...data.scopes.filter((s) => s.value !== scope).map((s) => ({ value: s.value, label: s.title }))]}
          />
        </View>
        <View className="gap-1.5">
          <Label>{t('grades.infSubject')}</Label>
          <Picker
            value={subject.id}
            onChange={(v) => {
              setSubjectPick(v);
              setMeasurePick(null);
            }}
            options={M.subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </View>
        <View className="gap-1.5">
          <Label>{t('grades.infMeasure')}</Label>
          <Picker value={measure?.key} onChange={setMeasurePick} options={subject.measures.map((m) => ({ value: m.key, label: m.label }))} />
        </View>
      </FormSection>

      <FormSection title={t('grades.infOptions')}>
        <View className="flex-row items-center justify-between gap-3">
          <Label className="flex-1">{t('grades.infShowNames')}</Label>
          <Switch checked={names} onCheckedChange={setNames} />
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Label className="flex-1">{t('grades.infShowLogo')}</Label>
          <Switch checked={logo && logoAvailable} onCheckedChange={setLogo} disabled={!logoAvailable} />
        </View>
        {!logoAvailable ? (
          <Text variant="muted" className="text-xs">
            {t('grades.infLogoHint')}
          </Text>
        ) : null}
      </FormSection>

      <FormSection title={t('grades.infReports')}>
        {GROUPS.map((g) => (
          <View key={g} className="gap-1">
            <Text variant="muted" className="text-xs font-semibold">
              {t(`grades.infGroup_${g}`)}
            </Text>
            {JG_INFOGRAPHIC_REPORTS.filter((r) => r.group === g).map((r) => {
              const disabled = avail[r.id] === false;
              return (
                <Pressable
                  key={r.id}
                  disabled={disabled}
                  onPress={() => toggle(r.id)}
                  className={cn('flex-row items-start gap-3 py-2', disabled && 'opacity-45')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected.has(r.id), disabled }}>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} disabled={disabled} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{t(`grades.infR_${r.id}`)}</Text>
                    <Text variant="muted" className="text-xs">
                      {disabled ? note(r.id) : t(`grades.infD_${r.id}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        {selected.has('card') ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
              <Label className="flex-1">{t('grades.infPickStudents')}</Label>
              <Switch checked={pickStudents} onCheckedChange={setPickStudents} />
            </View>
            {pickStudents ? (
              <MultiSelect
                options={withCard.map((i) => ({ id: String(i), label: M.students[i].name }))}
                value={picked ?? withCard.map(String)}
                onChange={setPicked}
                placeholder={t('grades.infPickStudents')}
                title={t('grades.infPickStudents')}
              />
            ) : (
              <Text variant="muted" className="text-xs">
                {t('grades.infAllStudentsNote', { count: withCard.length })}
              </Text>
            )}
          </View>
        ) : null}
      </FormSection>

      <View className="gap-2">
        <Button disabled={!pages.length || !!busy} onPress={shareAllPdf}>
          <Icon as={FileDown} className="size-4 text-white" />
          <Text>{busy ? t('grades.infWorking', { done: busy.done, total: busy.total }) : t('grades.infSharePdf')}</Text>
        </Button>
        <Text variant="muted" className="text-center text-xs">
          {t('grades.infPagesCount', { count: pages.length })} · {t('grades.infImagesNoteApp')}
        </Text>
      </View>

      {pages.length ? (
        <View className="gap-5">
          {pages.slice(0, shown).map((p) => (
            <PreviewCard key={p.key} page={p} disabled={!!busy} onShare={() => shareOne(p)} onOpen={() => setViewer(p)} />
          ))}
          {pages.length > shown ? (
            <Button variant="outline" onPress={() => setShown((n) => n + PREVIEW_STEP)}>
              <Text>{t('grades.infShowMore', { count: pages.length - shown })}</Text>
            </Button>
          ) : null}
        </View>
      ) : (
        <Text variant="muted" className="py-8 text-center">
          {t('grades.infNoPages')}
        </Text>
      )}

      {/* Unscaled offscreen copy of the one page being captured. */}
      {stage ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -(PAGE_W + 200), top: 0, width: PAGE_W, height: PAGE_H }}>
          <View ref={stageRef} collapsable={false} style={{ width: PAGE_W, height: PAGE_H }}>
            {stage.node}
          </View>
        </View>
      ) : null}

      <Modal visible={!!viewer} animationType="slide" onRequestClose={() => setViewer(null)}>
        <View className="bg-background flex-1 pt-10">
          <View className="flex-row items-center justify-between gap-3 px-4 pb-2">
            <Text className="flex-1 font-semibold" numberOfLines={1}>
              {viewer?.title}
            </Text>
            <Button size="sm" variant="outline" onPress={() => setViewer(null)}>
              <Text>{t('common.close')}</Text>
            </Button>
          </View>
          <ScrollView horizontal>
            <ScrollView contentContainerClassName="p-2">
              <View style={{ width: PAGE_W * 0.9, height: PAGE_H * 0.9, overflow: 'hidden', direction: 'ltr' }}>
                <View style={{ width: PAGE_W, height: PAGE_H, transform: [{ scale: 0.9 }], transformOrigin: 'top left' }}>{viewer?.node}</View>
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** One page scaled to the screen width, with share-as-image and full-size buttons. */
function PreviewCard({ page, disabled, onShare, onOpen }: { page: BuiltPage; disabled: boolean; onShare: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  const [w, setW] = useState(0);
  const scale = w ? Math.min(1, w / PAGE_W) : 0.3;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
          {page.title}
        </Text>
        <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('grades.infFullSize')} className="p-1">
          <Icon as={Maximize2} className="text-brand dark:text-brand-secondary size-5" />
        </Pressable>
        <Pressable onPress={onShare} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('grades.infSaveImage')} className={cn('p-1', disabled && 'opacity-40')}>
          <Icon as={Share2} className="text-brand dark:text-brand-secondary size-5" />
        </Pressable>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} className="border-border overflow-hidden rounded-lg border" style={{ height: PAGE_H * scale, direction: 'ltr' }}>
        <View style={{ width: PAGE_W, height: PAGE_H, transform: [{ scale }], transformOrigin: 'top left' }}>{page.node}</View>
      </View>
    </View>
  );
}
