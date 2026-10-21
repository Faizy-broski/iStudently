import type { HonorRollStudent } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { FileDown, ImagePlus, Medal, Plus, Printer, Trophy, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { FilterChips } from '@/components/app/filter-chips';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { CheckMark, FormSection, IconTile, Initials, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYears, useMarkingPeriods } from '@/features/admin/grades';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { pickImageDataUri } from '@/lib/upload';

type Level = 'all' | HonorRollStudent['honor_level'];
const ALL = '__all__';

/** Same substitution fields as the web certificate editor; the ones without honor-roll data print "N/A". */
const TOKEN_CATEGORIES: Record<string, string[]> = {
  'Basic Info': ['__FULL_NAME__', '__FIRST_NAME__', '__LAST_NAME__', '__EMAIL__', '__PHONE__', '__PHOTO_URL__'],
  'Student ID': ['__STUDENT_ID__', '__STUDENT_NUMBER__', '__ADMISSION_NUMBER__', '__ROLL_NUMBER__', '__REGISTRATION_NUMBER__'],
  Academic: ['__GRADE_LEVEL__', '__CLASS_NAME__', '__SECTION__', '__SECTION_NAME__', '__ACADEMIC_YEAR__', '__HONOR_LEVEL__'],
  Personal: ['__ADMISSION_DATE__', '__JOINING_DATE__', '__DATE_OF_BIRTH__', '__AGE__', '__GENDER__', '__BLOOD_GROUP__', '__NATIONALITY__', '__RELIGION__', '__CASTE__', '__MOTHER_TONGUE__'],
  Address: ['__ADDRESS__', '__STREET_ADDRESS__', '__CITY__', '__STATE__', '__COUNTRY__', '__POSTAL_CODE__', '__PERMANENT_ADDRESS__', '__CURRENT_ADDRESS__'],
  'Parent/Guardian': ['__FATHER_NAME__', '__MOTHER_NAME__', '__PARENT_NAME__', '__GUARDIAN_NAME__', '__PARENT_PHONE__', '__FATHER_PHONE__', '__MOTHER_PHONE__', '__PARENT_EMAIL__', '__FATHER_OCCUPATION__', '__MOTHER_OCCUPATION__'],
  Emergency: ['__EMERGENCY_CONTACT__', '__EMERGENCY_PHONE__', '__EMERGENCY_NAME__', '__EMERGENCY_RELATION__'],
  Medical: ['__MEDICAL_CONDITIONS__', '__ALLERGIES__', '__MEDICATIONS__', '__SPECIAL_NEEDS__'],
  Transport: ['__BUS_ROUTE__', '__TRANSPORT_MODE__', '__PICKUP_POINT__', '__DROP_POINT__'],
  'Campus/School': ['__CAMPUS_NAME__', '__CAMPUS_ADDRESS__', '__CAMPUS_PHONE__', '__CAMPUS_CODE__', '__CAMPUS_EMAIL__', '__SCHOOL_NAME__', '__SCHOOL_ADDRESS__', '__SCHOOL_PHONE__', '__SCHOOL_EMAIL__', '__SCHOOL_LOGO__', '__SCHOOL_WEBSITE__', '__SCHOOL_MOTTO__'],
  Dates: ['__CURRENT_DATE__', '__CURRENT_YEAR__', '__ISSUE_DATE__'],
};

const DEFAULT_CERTIFICATE_HTML = `<div style="text-align: center; font-family: 'Times New Roman', serif; padding: 40px;">
  <h1 style="font-size: 36px; color: ${colors.brand}; margin-bottom: 10px;">Certificate of Achievement</h1>
  <p style="font-size: 18px; color: ${colors.printMuted}; margin-bottom: 30px;">__SCHOOL_NAME__</p>
  <p style="font-size: 16px; margin-bottom: 10px;">This is to certify that</p>
  <h2 style="font-size: 28px; color: ${colors.brandSecondary}; margin: 20px 0;">__FULL_NAME__</h2>
  <p style="font-size: 16px; margin-bottom: 5px;">of Grade __GRADE_LEVEL__ — Section __SECTION_NAME__</p>
  <p style="font-size: 16px; margin-bottom: 20px;">has been placed on the</p>
  <h3 style="font-size: 24px; color: ${colors.brand}; margin: 15px 0;">__HONOR_LEVEL__</h3>
  <p style="font-size: 16px; margin-bottom: 30px;">for the Academic Year __ACADEMIC_YEAR__</p>
  <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 60px;">
    <div style="text-align: center;">
      <div style="border-top: 1px solid ${colors.printText}; width: 200px; margin-top: 40px; padding-top: 5px;">Principal</div>
    </div>
    <div style="text-align: center;">
      <p style="margin-bottom: 0;">__CURRENT_DATE__</p>
      <div style="border-top: 1px solid ${colors.printText}; width: 200px; margin-top: 5px; padding-top: 5px;">Date</div>
    </div>
  </div>
</div>`;

const CERT_CSS = `@page{size:landscape;margin:0}body{margin:0;padding:0}.certificate-page{width:100vw;height:100vh;page-break-after:always;display:flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box}.certificate-page:last-child{page-break-after:auto}.certificate-frame{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;z-index:0}.certificate-content{position:relative;z-index:1;width:80%;max-width:900px}`;

const Box = CheckMark;

/** Honor roll list (PDF) and printable certificates with substitution fields and a frame image (web: /admin/grades/honor-roll). */
export default function HonorRoll() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.honor_roll.${k}`, o);
  const c = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.common.${k}`, o);
  const h = (k: string, o?: Record<string, unknown>) => t(`app.hr_${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { campusId, campus } = useCampus();
  const mps = useMarkingPeriods();
  const years = useAcademicYears();
  const [mode, setMode] = useState<'list' | 'certificates'>('list');
  const [mp, setMp] = useState<string | null>(null);
  const [ay, setAy] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>('all');
  const [grade, setGrade] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState(DEFAULT_CERTIFICATE_HTML);
  const [token, setToken] = useState('__FULL_NAME__');
  const insert = useRef<((x: string) => void) | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const markingPeriod = mp ?? mps.selectedQuarterId ?? mps.list.find((m) => m.mp_type === 'QTR')?.id ?? mps.list[0]?.id ?? null;
  const yearId = ay ?? years.current?.id ?? null;
  const list = useApi(markingPeriod ? ['admin', 'honor-roll', campusId ?? 'school', markingPeriod, yearId ?? ''] : null, ([, , cid, m, y]) =>
    adminGrades.honorRoll(cid === 'school' ? null : (cid as string), m as string, (y as string) || undefined),
  );
  const all = list.data ?? [];
  const gradeNames = [...new Set(all.map((x) => x.grade_level).filter(Boolean))].sort();
  const rows = all.filter((x) => (level === 'all' || x.honor_level === level) && (grade === ALL || x.grade_level === grade));
  const levelLabel = (l: HonorRollStudent['honor_level']) => t(l === 'high_honor' ? 'app.gr_high_honor' : 'app.gr_honor');
  const mpTitle = mps.list.find((m) => m.id === markingPeriod)?.title ?? '';

  async function sharePdfList() {
    setBusy(true);
    try {
      const body = `<div class="record-header"><span>${escapeHtml(s('title'))}</span><span class="rh-right">${escapeHtml(mpTitle)}</span></div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px"><tr>${[c('student'), c('grade_level_header'), s('honor_level')].map((x) => `<th style="text-align:start;padding:6px 4px;border-bottom:2px solid ${colors.printText};font-size:11px">${escapeHtml(x)}</th>`).join('')}</tr>
        ${rows.map((x) => `<tr><td style="padding:5px 4px;border-bottom:1px solid ${colors.printBorder}">${escapeHtml(`${x.first_name} ${x.last_name}`)}</td><td style="padding:5px 4px;border-bottom:1px solid ${colors.printBorder}">${escapeHtml([x.grade_level, x.section].filter(Boolean).join(' · '))}</td><td style="padding:5px 4px;border-bottom:1px solid ${colors.printBorder}">${escapeHtml(levelLabel(x.honor_level))}</td></tr>`).join('')}</table>`;
      await sharePdf(buildPrintHtml({ title: s('title'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: s('title') }), `honor-roll-${mpTitle || 'list'}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  }

  const substitute = (x: HonorRollStudent) => {
    const yearName = years.list.find((y) => y.id === yearId)?.name;
    const today = new Date().toLocaleDateString(i18n.language);
    const map: Record<string, string> = {
      __FIRST_NAME__: x.first_name || 'N/A',
      __LAST_NAME__: x.last_name || 'N/A',
      __FULL_NAME__: `${x.first_name} ${x.last_name}`.trim() || 'N/A',
      __STUDENT_NUMBER__: x.student_number || 'N/A',
      __GRADE_LEVEL__: x.grade_level || 'N/A',
      __CLASS_NAME__: x.section || 'N/A',
      __SECTION__: x.section || 'N/A',
      __SECTION_NAME__: x.section || 'N/A',
      __ACADEMIC_YEAR__: yearName || 'N/A',
      __HONOR_LEVEL__: levelLabel(x.honor_level),
      __SCHOOL_NAME__: campus?.name || 'N/A',
      __CAMPUS_NAME__: campus?.name || 'N/A',
      __CURRENT_DATE__: today,
      __CURRENT_YEAR__: String(new Date().getFullYear()),
      __ISSUE_DATE__: today,
    };
    let out = html;
    for (const [k, v] of Object.entries(map)) out = out.split(k).join(escapeHtml(v));
    return out.replace(/__[A-Z_]+__/g, 'N/A');
  };
  async function certificates(kind: 'print' | 'pdf') {
    const chosen = all.filter((x) => selected.has(x.student_id));
    if (!chosen.length) return toast.error(h('select_student'));
    setBusy(true);
    try {
      const pages = chosen.map((x) => `<div class="certificate-page">${frame ? `<img class="certificate-frame" src="${frame}" />` : ''}<div class="certificate-content">${substitute(x)}</div></div>`).join('');
      const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Honor Roll Certificates</title><style>${CERT_CSS}</style></head><body>${pages}</body></html>`;
      if (kind === 'print') await printHtml(doc);
      else await sharePdf(doc, 'honor-roll-certificates.pdf', { width: 842, height: 595 });
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  }
  async function chooseFrame() {
    const uri = await pickImageDataUri();
    if (uri) {
      setFrame(uri);
      toast.success(h('frame_added'));
    }
  }
  const toggle = (id: string) => setSelected((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));
  const allSelected = all.length > 0 && selected.size === all.length;

  const filters = (
    <Panel className="gap-3 p-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: h('mode_list') },
          { value: 'certificates', label: h('mode_certificates') },
        ]}
      />
      <Picker value={markingPeriod} onChange={setMp} options={mps.options} placeholder={s('select_mp')} />
      <Picker value={yearId} onChange={setAy} options={years.list.map((y) => ({ value: y.id, label: y.name }))} placeholder={h('academic_year')} />
    </Panel>
  );
  const highCount = rows.filter((x) => x.honor_level === 'high_honor').length;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>
        {filters}
        {list.isLoading || mps.isLoading ? (
          <LoadingList rows={4} />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={() => list.mutate()} />
        ) : mode === 'list' ? (
          <>
            <StatTiles>
              <StatTile icon={Trophy} tone="warning" label={levelLabel('high_honor')} value={String(highCount)} />
              <StatTile icon={Medal} label={levelLabel('honor')} value={String(rows.length - highCount)} />
            </StatTiles>
            <FilterChips<Level>
              value={level}
              onChange={setLevel}
              options={[
                { value: 'all', label: c('all') },
                { value: 'high_honor', label: levelLabel('high_honor') },
                { value: 'honor', label: levelLabel('honor') },
              ]}
            />
            {gradeNames.length > 1 ? <FilterChips value={grade} onChange={setGrade} options={[{ value: ALL, label: c('all_grade_levels') }, ...gradeNames.map((g) => ({ value: g, label: g }))]} /> : null}
            <View className="flex-row items-center justify-between gap-3">
              <StatusChip label={c('students_found', { count: rows.length })} tone="info" className="px-2.5 py-1" />
              <Button size="sm" variant="outline" onPress={sharePdfList} disabled={busy || !rows.length || !print.ready}>
                <Icon as={FileDown} className="text-foreground size-4" />
                <Text>PDF</Text>
              </Button>
            </View>
            {!rows.length ? (
              <EmptyState title={s('no_students')} />
            ) : (
              (['high_honor', 'honor'] as const).map((lv) => {
                const group = rows.filter((x) => x.honor_level === lv);
                if (!group.length) return null;
                return (
                  <Section key={lv} title={`${levelLabel(lv)} (${group.length})`}>
                    <Panel>
                      {group.map((x, i) => {
                        const name = `${x.first_name} ${x.last_name}`;
                        return (
                          <RowItem
                            key={x.student_id}
                            leading={<Initials name={name} tone={lv === 'high_honor' ? 'warning' : 'brand'} size={38} />}
                            title={name}
                            meta={[x.student_number, x.grade_level, x.section, x.teacher].filter(Boolean).join(' · ')}
                            trailing={<StatusChip label={`#${i + 1}`} tone={lv === 'high_honor' ? 'warning' : 'info'} className="px-2 py-0.5" />}
                            last={i === group.length - 1}
                          />
                        );
                      })}
                    </Panel>
                  </Section>
                );
              })
            )}
          </>
        ) : (
          <>
            <FormSection title={h('template')} description={h('substitution_fields')}>
              <View className="flex-row items-center gap-2">
                <Picker
                  className="flex-1"
                  value={token}
                  onChange={setToken}
                  options={Object.entries(TOKEN_CATEGORIES).flatMap(([cat, toks]) => [{ value: `__CAT_${cat}__`, label: `— ${cat} —`, disabled: true }, ...toks.map((x) => ({ value: x, label: x }))])}
                />
                <Button size="sm" variant="outline" onPress={() => insert.current?.(token)}>
                  <Icon as={Plus} className="text-foreground size-4" />
                  <Text>{h('insert')}</Text>
                </Button>
              </View>
              <HtmlEditorField value={html} onChange={setHtml} insertRef={(fn) => (insert.current = fn)} />
              <Button size="sm" variant="ghost" className="self-start" onPress={() => setHtml(DEFAULT_CERTIFICATE_HTML)}>
                <Text>{h('reset_template')}</Text>
              </Button>
            </FormSection>
            <FormSection title={h('frame')} description={h('frame_hint')}>
              {frame ? (
                <View className="gap-2">
                  <View className="border-info-soft dark:border-border h-32 overflow-hidden rounded-xl border">
                    <Image source={{ uri: frame }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                  </View>
                  <Button size="sm" variant="ghost" className="self-start" onPress={() => setFrame(null)}>
                    <Icon as={X} className="text-destructive size-4" />
                    <Text className="text-destructive">{h('frame_remove')}</Text>
                  </Button>
                </View>
              ) : (
                <Pressable onPress={chooseFrame} className="border-info-soft dark:border-border items-center gap-2 rounded-2xl border-2 border-dashed py-6 active:opacity-70" accessibilityRole="button">
                  <IconTile icon={ImagePlus} round />
                  <Text className="text-brand dark:text-brand-secondary text-sm font-semibold">{h('frame_upload')}</Text>
                </Pressable>
              )}
            </FormSection>
            <Panel>
              <Pressable onPress={() => setSelected(allSelected ? new Set() : new Set(all.map((x) => x.student_id)))} className="bg-info-soft/60 flex-row items-center gap-3 rounded-t-2xl px-4 py-3 active:opacity-70">
                <Box on={allSelected} />
                <Text className="text-brand dark:text-brand-secondary text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
              </Pressable>
              {!all.length ? <EmptyState title={s('no_students')} /> : null}
              {all.map((x) => {
                const name = `${x.first_name} ${x.last_name}`;
                return (
                  <Pressable
                    key={x.student_id}
                    onPress={() => toggle(x.student_id)}
                    className="border-info-soft dark:border-border flex-row items-center gap-3 border-t px-4 py-2.5 active:opacity-70"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected.has(x.student_id) }}>
                    <Box on={selected.has(x.student_id)} />
                    <Initials name={name} size={32} tone={x.honor_level === 'high_honor' ? 'warning' : 'brand'} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{name}</Text>
                      <Text variant="muted" className="text-[11px]">
                        {[x.grade_level, x.section, levelLabel(x.honor_level)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </Panel>
            <View className="flex-row gap-2">
              <Button className="flex-1" variant="outline" onPress={() => certificates('pdf')} disabled={busy}>
                <Icon as={FileDown} className="text-foreground size-4" />
                <Text>PDF</Text>
              </Button>
              <Button className="flex-1" onPress={() => certificates('print')} disabled={busy}>
                <Icon as={Printer} className="text-primary-foreground size-4" />
                <Text>{s('print_certificates')}</Text>
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
