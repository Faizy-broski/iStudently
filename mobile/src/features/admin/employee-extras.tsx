import { ILR_LEVELS, type HrQualifications } from '@studently/api-client';
import { router } from 'expo-router';
import { AlertCircle, BarChart3, FileText, Pencil, Plus, Printer, Share2, Trash2, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { InfoCard } from '@/components/app/info';
import { IconTile, StatTile, StatTiles, type Tone } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminHumanResources, adminPerformance, complaints } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { escapeHtml, printHtml, qrSvg, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

const k = (x: string) => `app.hq_${x}`;

// ── Verification QR ──────────────────────────────────────────────────────────

/** QR that opens the person's verification page (web: UserQRCode). */
export function VerifyQr({ profileId, label }: { profileId: string; label: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const value = `${env.webUrl}/verify/${profileId}`;
  const html = () => `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}.qr{width:240px;height:240px;margin:16px auto}.qr svg{width:100%;height:100%}</style></head><body><h2>${escapeHtml(label)}</h2><div class="qr">${qrSvg(value)}</div></body></html>`;
  const out = async (kind: 'print' | 'pdf') => {
    try {
      if (kind === 'print') await printHtml(html());
      else await sharePdf(html(), `qr-${profileId.slice(0, 8)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    }
  };
  return (
    <View className="border-info-soft dark:border-border bg-card items-center gap-2 rounded-2xl border p-3">
      <View className="rounded-xl bg-white p-2">
        <QRCode value={value} size={100} bgColor={colors.white} fgColor={colors.black} />
      </View>
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row gap-2">
        <Pressable onPress={() => out('print')} hitSlop={4} accessibilityRole="button" className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Printer} className="text-brand dark:text-brand-secondary size-4" />
        </Pressable>
        <Pressable onPress={() => out('pdf')} hitSlop={4} accessibilityRole="button" className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Share2} className="text-brand dark:text-brand-secondary size-4" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Qualifications ───────────────────────────────────────────────────────────

type Kind = 'skills' | 'education' | 'certifications' | 'languages';
type Form = Record<string, string>;
const BLANK: Record<Kind, Form> = {
  skills: { title: '', description: '' },
  education: { qualification: '', institute: '', start_date: '', completed_on: '' },
  certifications: { title: '', institute: '', granted_on: '', valid_through: '' },
  languages: { title: '', reading: '', speaking: '', writing: '' },
};

/** Skills, education, certifications and languages with add/edit/delete (web: QualificationsTab). */
export function QualificationsCard({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'hr-qualifications', profileId], ([, , p]) => adminHumanResources.qualifications(p as string));
  const [editing, setEditing] = useState<{ kind: Kind; id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const q: HrQualifications = res.data ?? { skills: [], education: [], certifications: [], languages: [] };
  const ilr = (v?: string | null) => (v ? t(k(`ilr_${v}`)) : '—');
  const api = {
    skills: { c: adminHumanResources.createSkill, u: adminHumanResources.updateSkill, d: adminHumanResources.removeSkill },
    education: { c: adminHumanResources.createEducation, u: adminHumanResources.updateEducation, d: adminHumanResources.removeEducation },
    certifications: { c: adminHumanResources.createCertification, u: adminHumanResources.updateCertification, d: adminHumanResources.removeCertification },
    languages: { c: adminHumanResources.createLanguage, u: adminHumanResources.updateLanguage, d: adminHumanResources.removeLanguage },
  } as const;
  const required: Record<Kind, string> = { skills: 'title', education: 'qualification', certifications: 'title', languages: 'title' };

  async function save() {
    if (!editing) return;
    const { kind, id, form } = editing;
    if (!form[required[kind]]?.trim()) return toast.error(t(k('required')));
    const body = Object.fromEntries(Object.entries(form).map(([key, v]) => [key, v.trim() === '' ? null : v.trim()]));
    setSaving(true);
    try {
      const r = id ? await api[kind].u(id, body) : await api[kind].c({ ...body, profile_id: profileId, campus_id: campusId ?? null });
      if (!r.success) return toast.error(r.error || t('common.error'));
      setEditing(null);
      res.mutate();
    } finally {
      setSaving(false);
    }
  }
  async function remove(kind: Kind, id: string, label: string) {
    if (!(await confirm({ title: t('common.delete'), body: label, destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await api[kind].d(id);
    if (!r.success) return toast.error(r.error || t('common.error'));
    res.mutate();
  }

  const field = (key: string, label: string, kind: 'text' | 'date' | 'ilr' = 'text', placeholder?: string) => {
    if (!editing) return null;
    const v = editing.form[key] ?? '';
    const set = (x: string) => setEditing({ ...editing, form: { ...editing.form, [key]: x } });
    if (kind === 'date') return <DateField key={key} label={label} value={v} onChange={set} clearable />;
    if (kind === 'ilr')
      return (
        <View key={key} className="gap-1">
          <Label>{label}</Label>
          <Picker value={v || '__none__'} onChange={(x) => set(x === '__none__' ? '' : x)} options={[{ value: '__none__', label: 'N/A' }, ...ILR_LEVELS.map((l) => ({ value: l, label: t(k(`ilr_${l}`)) }))]} />
        </View>
      );
    return (
      <View key={key} className="gap-1">
        <Label>{label}</Label>
        <Input value={v} onChangeText={set} placeholder={placeholder} />
      </View>
    );
  };
  const editor =
    editing ? (
      <View className="bg-info-soft/60 dark:bg-muted gap-2 rounded-2xl p-3">
          {editing.kind === 'skills' ? [field('title', `${t(k('skill'))} *`, 'text', t(k('ph_skill'))), field('description', t(k('description')), 'text', t(k('ph_description')))] : null}
          {editing.kind === 'education' ? [field('qualification', `${t(k('qualification'))} *`, 'text', t(k('ph_qualification'))), field('institute', t(k('institute')), 'text', t(k('ph_institute'))), field('start_date', t(k('start_date')), 'date'), field('completed_on', t(k('completed_on')), 'date')] : null}
          {editing.kind === 'certifications' ? [field('title', `${t(k('certification'))} *`, 'text', t(k('ph_certification'))), field('institute', t(k('institute')), 'text', t(k('ph_issuer'))), field('granted_on', t(k('granted_on')), 'date'), field('valid_through', t(k('valid_through')), 'date')] : null}
          {editing.kind === 'languages' ? [field('title', `${t(k('language'))} *`, 'text', t(k('ph_language'))), field('reading', t(k('reading')), 'ilr'), field('speaking', t(k('speaking')), 'ilr'), field('writing', t(k('writing')), 'ilr')] : null}
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="outline" onPress={() => setEditing(null)} disabled={saving}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={save} disabled={saving}>
              <Text>{t('common.save')}</Text>
            </Button>
          </View>
      </View>
    ) : null;

  const section = (kind: Kind, title: string, rows: { id: string; label: string; hint: string; form: Form }[]) => (
    <View className="gap-1">
      <View className="flex-row items-center">
        <Text className="flex-1 text-sm font-semibold">{title}</Text>
        <Pressable onPress={() => setEditing({ kind, id: null, form: { ...BLANK[kind] } })} hitSlop={8} accessibilityRole="button" className="bg-info-soft size-8 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Plus} className="text-brand dark:text-brand-secondary size-4" />
        </Pressable>
      </View>
      {!rows.length ? <Text className="text-muted-foreground text-xs">—</Text> : null}
      {rows.map((r) => (
        <View key={r.id} className="flex-row items-center gap-2 py-1.5">
          <View className="flex-1">
            <Text className="text-sm font-medium">{r.label}</Text>
            {r.hint ? <Text className="text-muted-foreground text-xs">{r.hint}</Text> : null}
          </View>
          <Pressable onPress={() => setEditing({ kind, id: r.id, form: r.form })} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
            <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
          </Pressable>
          <Pressable onPress={() => remove(kind, r.id, r.label)} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
            <Icon as={Trash2} className="text-destructive size-4" />
          </Pressable>
        </View>
      ))}
    </View>
  );
  const s = (v?: string | null) => v ?? '';
  return (
    <InfoCard title={t('teachers.tabs.qualifications', { defaultValue: t(k('title')) })}>
      {res.isLoading ? (
        <LoadingList rows={2} />
      ) : (
        <View className="gap-3 py-2">
          {editor}
          {section('skills', t(k('skills')), q.skills.map((x) => ({ id: x.id, label: x.title, hint: s(x.description), form: { title: x.title, description: s(x.description) } })))}
          <Separator />
          {section('education', t(k('education')), q.education.map((x) => ({ id: x.id, label: x.qualification, hint: [x.institute, [x.start_date && formatDate(x.start_date), x.completed_on && formatDate(x.completed_on)].filter(Boolean).join(' – ')].filter(Boolean).join(' · '), form: { qualification: x.qualification, institute: s(x.institute), start_date: s(x.start_date), completed_on: s(x.completed_on) } })))}
          <Separator />
          {section('certifications', t(k('certifications')), q.certifications.map((x) => ({ id: x.id, label: x.title, hint: [x.institute, x.granted_on && formatDate(x.granted_on), x.valid_through && `→ ${formatDate(x.valid_through)}`].filter(Boolean).join(' · '), form: { title: x.title, institute: s(x.institute), granted_on: s(x.granted_on), valid_through: s(x.valid_through) } })))}
          <Separator />
          {section('languages', t(k('languages')), q.languages.map((x) => ({ id: x.id, label: x.title, hint: `${t(k('reading'))}: ${ilr(x.reading)} · ${t(k('speaking'))}: ${ilr(x.speaking)} · ${t(k('writing'))}: ${ilr(x.writing)}`, form: { title: x.title, reading: s(x.reading), speaking: s(x.speaking), writing: s(x.writing) } })))}
        </View>
      )}
    </InfoCard>
  );
}

// ── Performance ──────────────────────────────────────────────────────────────

/** Score, demerits, redemptions, incidents, complaints and the incident log (web: teacher/staff Performance tab). */
export function PerformanceCard({ staffId, profileId }: { staffId: string; profileId?: string | null }) {
  const { t } = useTranslation();
  const score = useApi(['admin', 'perf-score', staffId], ([, , s]) => adminPerformance.staffScore(s as string));
  const logs = useApi(['admin', 'perf-logs', staffId], ([, , s]) => adminPerformance.staffLogs(s as string, 50));
  const pid = profileId ?? null;
  const count = useApi(pid ? ['admin', 'complaint-count', pid] : null, async ([, , p]) => {
    const r = await complaints.list('all', { person_involved_profile_id: p as string, limit: 1 });
    return { ...r, data: r.success ? (r.pagination?.total ?? r.data?.length ?? 0) : undefined };
  });
  const total = count.data ?? null;
  const sc = score.data;
  const tone = sc ? (sc.score >= 80 ? 'text-success' : sc.score >= 60 ? 'text-warning' : 'text-destructive') : '';
  const stat = (label: string, value: string | number, tile: Tone, icon: typeof TrendingDown, onPress?: () => void) => (
    <StatTile label={label} value={String(value)} tone={tile} icon={icon} onPress={onPress} />
  );
  return (
    <InfoCard title={t(k('performance'))}>
      {score.isLoading || logs.isLoading ? (
        <LoadingList rows={3} />
      ) : (
        <View className="gap-3 py-2">
          {sc ? (
            <>
              <View className="bg-muted/50 items-center gap-1 rounded-2xl py-4">
                <Text className={cn('text-4xl font-bold', tone)}>{sc.score}</Text>
                <Text className="text-muted-foreground text-xs">/ 100</Text>
                <Text className={cn('text-sm font-semibold', tone)}>{t(k(sc.score >= 80 ? 'perf_excellent' : sc.score >= 60 ? 'perf_good' : 'perf_needs'))}</Text>
              </View>
              <StatTiles>
                {stat(t(k('total_demerit')), `-${sc.total_demerit}`, 'destructive', TrendingDown)}
                {stat(t(k('total_redemption')), `+${sc.total_redemption}`, 'success', TrendingUp)}
                {stat(t(k('total_incidents')), sc.log_count, 'brand', BarChart3)}
                {stat(t(k('complaints')), total ?? '—', 'warning', AlertCircle, pid ? () => router.push('/admin/grievances') : undefined)}
              </StatTiles>
            </>
          ) : null}
          <View className="flex-row items-center">
            <Text className="flex-1 text-sm font-semibold">{t(k('incident_log'))}</Text>
            <Pressable className="bg-info-soft rounded-full px-3 py-1.5 active:opacity-70" onPress={() => router.push('/admin/performance')} hitSlop={8}>
              <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t(k('view_all'))}</Text>
            </Pressable>
          </View>
          {!(logs.data ?? []).length ? <Text className="text-muted-foreground py-2 text-center text-sm">{t(k('no_incidents'))}</Text> : null}
          {(logs.data ?? []).map((l) => {
            const demerit = l.action?.action_type === 'violation_demerit';
            const pts = l.custom_points ?? l.action?.default_points ?? 0;
            return (
              <View key={l.id}>
                <Separator />
                <View className="flex-row items-center gap-3 py-2.5">
                  <IconTile icon={demerit ? TrendingDown : TrendingUp} tone={demerit ? 'destructive' : 'success'} size={36} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{l.action?.action_name_en}</Text>
                    {l.action?.action_name_ar ? <Text className="text-muted-foreground text-xs">{l.action.action_name_ar}</Text> : null}
                    <Text className="text-muted-foreground text-xs">
                      {formatDate(l.created_at)}
                      {l.notes ? ` · ${l.notes}` : ''}
                    </Text>
                  </View>
                  <View className="items-end gap-1">
                    <StatusChip label={t(k(demerit ? 'violation' : 'reward'))} tone={demerit ? 'destructive' : 'success'} />
                    <Text className={cn('text-sm font-bold', demerit ? 'text-destructive' : 'text-success')}>{demerit ? pts : `+${pts}`}</Text>
                    {l.letter_generated ? <Icon as={FileText} className="size-4 text-warning" /> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </InfoCard>
  );
}
