import { CONFIDENTIAL_FAMILY_STATUSES, type ConfidentialFamilyStatus } from '@studently/api-client';
import { Eye, EyeOff, Lock, Printer, RefreshCw, Share2, ShieldAlert, ShieldCheck, TrendingDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { InfoCard } from '@/components/app/info';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminDiscipline, adminMiqat, adminStudents, adminUserProfiles } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { escapeHtml, printHtml, qrSvg, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

const pf = (k: string) => `app.pe_${k}`;

// ── Confidential family status ───────────────────────────────────────────────

export function ConfidentialBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  if (!status || status === 'NONE') return null;
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 ">
      <Icon as={Lock} className="size-3 text-warning " />
      <Text className="text-xs text-warning ">{t(pf(`cfs_${status}`))}</Text>
    </View>
  );
}

/** Admin/counselor-only family status (web: ConfidentialFamilyStatusDialog). */
export function ConfidentialStatusCard({ studentId, status, onSaved }: { studentId: string; status?: string | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const [value, setValue] = useState<ConfidentialFamilyStatus>((status as ConfidentialFamilyStatus) || 'NONE');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await adminStudents.setConfidentialStatus(campusId, studentId, value);
      if (!r.success) return toast.error(r.error || t(pf('cfs_failed')));
      toast.success(t(pf('cfs_saved')));
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <InfoCard title={t(pf('cfs_title'))}>
      <View className="gap-2 py-2">
        <Text className="text-muted-foreground text-xs">{t(pf('cfs_desc'))}</Text>
        <Picker value={value} onChange={(v) => setValue(v as ConfidentialFamilyStatus)} options={CONFIDENTIAL_FAMILY_STATUSES.map((x) => ({ value: x, label: t(pf(`cfs_opt_${x}`)) }))} />
        <Text className="text-muted-foreground text-xs">{t(pf('cfs_privacy'))}</Text>
        <Button size="sm" onPress={save} disabled={saving || value === ((status as ConfidentialFamilyStatus) || 'NONE')}>
          <Text>{t('common.save')}</Text>
        </Button>
      </View>
    </InfoCard>
  );
}

// ── Credentials ──────────────────────────────────────────────────────────────

/** Change the login username and/or set a new password (web: EditCredentialsModal). */
export function CredentialsCard({ profileId, onSave }: { profileId?: string | null; onSave: (p: { username?: string; password?: string }) => Promise<{ success: boolean; error?: string }> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const pid = profileId ?? null;
  const current = useApi(pid ? ['admin', 'username', pid] : null, ([, , p]) => adminStudents.username(p as string));
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const shown = username ?? current.data?.username ?? '';

  async function save() {
    const u = shown.trim();
    const changedUser = u.length > 0 && u !== (current.data?.username ?? '');
    if (!changedUser && !password) return setError(t(pf('cr_nothing')));
    if (password && password.length < 8) return setError(t('app.v_min8'));
    setSaving(true);
    setError('');
    try {
      const r = await onSave({ ...(changedUser ? { username: u } : {}), ...(password ? { password } : {}) });
      if (!r.success) return setError(r.error || t(pf('cr_failed')));
      toast.success(t(pf('cr_saved')));
      setPassword('');
      current.mutate();
    } finally {
      setSaving(false);
    }
  }
  return (
    <InfoCard title={t(pf('cr_title'))}>
      <View className="gap-2 py-2">
        <Label>{t('school.students.fields.username')}</Label>
        <Input value={shown} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder={current.isLoading ? '…' : undefined} />
        <Label>{t(pf('cr_new_password'))}</Label>
        <View className="flex-row items-center gap-2">
          <Input className="flex-1" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} />
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} className="p-1">
            <Icon as={show ? EyeOff : Eye} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
        {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
        <Button size="sm" onPress={save} disabled={saving}>
          <Text>{t('common.save')}</Text>
        </Button>
      </View>
    </InfoCard>
  );
}

// ── Access role ──────────────────────────────────────────────────────────────

/** Limit a login to a User Profile role; "Default" = full access (web: AccessRoleCard). */
export function AccessRoleCard({ entityType, entityId, baseRole, title, description, defaultLabel }: { entityType: 'staff' | 'student' | 'parent'; entityId: string; baseRole: 'staff' | 'teacher' | 'librarian' | 'student' | 'parent'; title: string; description: string; defaultLabel: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const roles = useApi(['admin', 'user-roles'], () => adminUserProfiles.roles());
  const assigned = useApi(['admin', 'assigned-role', entityType, entityId], ([, , ty, id]) => adminUserProfiles.assignedRole(ty as 'staff' | 'student' | 'parent', id as string));
  const [saving, setSaving] = useState(false);
  const current = assigned.data?.role_id ?? 'default';
  const options = (roles.data ?? []).filter((r) => r.base_role === baseRole);

  async function change(value: string) {
    if (value === current) return;
    setSaving(true);
    try {
      const r =
        entityType === 'staff'
          ? value !== 'default'
            ? await adminUserProfiles.cloneForStaff(value, entityId)
            : await adminUserProfiles.removeStaffProfile(entityId)
          : value !== 'default'
            ? await adminUserProfiles.cloneForEntity(value, entityType, entityId)
            : await adminUserProfiles.removeEntityProfile(entityType, entityId);
      if (!r.success) return toast.error(r.error || t(pf('ar_failed')));
      toast.success(t(pf('ar_saved')));
      assigned.mutate({ role_id: value === 'default' ? null : value }, { revalidate: true });
    } finally {
      setSaving(false);
    }
  }
  return (
    <InfoCard title={title}>
      <View className="gap-2 py-2">
        <View className="flex-row items-center gap-1.5">
          <Icon as={ShieldCheck} className="text-muted-foreground size-4" />
          <Text className="text-muted-foreground flex-1 text-xs">{description}</Text>
        </View>
        {roles.isLoading || assigned.isLoading ? (
          <LoadingList rows={1} />
        ) : (
          <View pointerEvents={saving ? 'none' : 'auto'} className={cn(saving && 'opacity-60')}>
            <Picker value={current} onChange={change} options={[{ value: 'default', label: defaultLabel }, ...options.map((r) => ({ value: r.id, label: r.name }))]} />
          </View>
        )}
        {!roles.isLoading && !options.length ? <Text className="text-muted-foreground text-xs">{t(pf('ar_none'), { role: baseRole })}</Text> : null}
      </View>
    </InfoCard>
  );
}

// ── Miqat card ───────────────────────────────────────────────────────────────

/** A person's Miqat QR card: view, print, share, report lost & reissue (web: MiqatCardPanel). */
export function MiqatCard({ personId, name }: { personId: string; name: string }) {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`miqat.cards.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'miqat-card', personId, campusId ?? 'school'], ([, , p]) => adminMiqat.cardQrBatch([p as string], campusId));
  const [reissued, setReissued] = useState<{ qr: string; revision: number } | null>(null);
  const [busy, setBusy] = useState(false);
  if (res.error?.message?.includes('not enabled')) return null;
  const failed = res.data?.signing_key_error || res.data?.failed?.[personId] || (res.error ? res.error.message || c('issueError') : null);
  const qr = reissued?.qr ?? res.data?.qr?.[personId] ?? null;
  const revision = reissued?.revision ?? null;
  const html = () =>
    `<!doctype html><html dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}.qr{width:260px;height:260px;margin:16px auto}.qr svg{width:100%;height:100%}h1{font-size:20px;margin:0}p{color:${colors.printMuted};font-size:13px}</style></head><body><h1>${escapeHtml(name)}</h1><div class="qr">${qrSvg(qr ?? '')}</div>${revision != null ? `<p>${escapeHtml(c('revisionLabel'))}: ${revision}</p>` : ''}</body></html>`;
  async function out(kind: 'print' | 'pdf') {
    try {
      if (kind === 'print') await printHtml(html());
      else await sharePdf(html(), `miqat-card-${personId}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : c('printError'));
    }
  }
  async function reissue() {
    setBusy(true);
    try {
      const r = await adminMiqat.reportCardLost(personId, campusId);
      if (!r.success || !r.data) return toast.error(r.error || c('issueError'));
      if (r.data.signing_key_error) return toast.error(r.data.signing_key_error);
      if (r.data.qr_payload) setReissued({ qr: r.data.qr_payload, revision: r.data.revision });
      toast.success(c('reissueLost'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="border-info-soft dark:border-border items-center gap-2 rounded-xl border p-3">
      {res.isLoading ? (
        <LoadingList rows={1} />
      ) : failed && !qr ? (
        <Text className="text-center text-xs text-destructive">{failed}</Text>
      ) : qr ? (
        <>
          <View className="rounded bg-white p-2">
            <QRCode value={qr} size={110} bgColor={colors.white} fgColor={colors.black} />
          </View>
          <Text className="text-muted-foreground max-w-[200px] text-center text-xs" numberOfLines={1}>
            {name}
          </Text>
          <View className="flex-row gap-1">
            <Button size="sm" variant="ghost" onPress={() => out('print')} accessibilityLabel={c('print')}>
              <Icon as={Printer} className="text-foreground size-4" />
            </Button>
            <Button size="sm" variant="ghost" onPress={() => out('pdf')} accessibilityLabel={c('download')}>
              <Icon as={Share2} className="text-foreground size-4" />
            </Button>
            <Button size="sm" variant="ghost" onPress={reissue} disabled={busy} accessibilityLabel={c('reissueLost')}>
              <Icon as={RefreshCw} className="text-foreground size-4" />
            </Button>
          </View>
        </>
      ) : null}
    </View>
  );
}

// ── Discipline score ─────────────────────────────────────────────────────────

const TIERS = [
  { min: 100, key: 'excellent', bg: 'bg-info-soft ', text: 'text-brand dark:text-brand-secondary ' },
  { min: 90, key: 'good', bg: 'bg-success-soft ', text: 'text-success ' },
  { min: 70, key: 'fair', bg: 'bg-warning-soft ', text: 'text-warning ' },
  { min: 50, key: 'poor', bg: 'bg-warning-soft ', text: 'text-warning ' },
  { min: -Infinity, key: 'critical', bg: 'bg-destructive-soft ', text: 'text-destructive ' },
];

/** 100-point discipline score with the penalty breakdown (web: DisciplineScoreTab). */
export function DisciplineScoreCard({ studentId, academicYearId }: { studentId: string; academicYearId?: string | null }) {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'discipline-score', studentId, campusId ?? 'school', academicYearId ?? ''], ([, , s, , y]) => adminDiscipline.getStudentScore(s as string, campusId, (y as string) || null));
  const r = res.data;
  const tier = r ? TIERS.find((x) => r.score >= x.min)! : TIERS[0];
  return (
    <InfoCard title={t(pf('ds_title'))}>
      {res.isLoading ? (
        <LoadingList rows={2} />
      ) : !r ? (
        <View className="items-center gap-2 py-4">
          <Icon as={ShieldAlert} className="text-muted-foreground size-8 opacity-40" />
          <Text className="text-muted-foreground text-sm">{res.error?.message || t(pf('ds_failed'))}</Text>
        </View>
      ) : (
        <View className="gap-3 py-2">
          <View className={cn('flex-row items-center gap-4 rounded-xl p-4', tier.bg)}>
            <View className="items-center">
              <Text className={cn('text-4xl font-bold', tier.text)}>{r.score}</Text>
              <Text className={cn('text-xs opacity-70', tier.text)}>/ 100</Text>
            </View>
            <View className="flex-1 gap-1">
              <Badge variant="outline" className="self-start">
                <Text className={cn('text-xs', tier.text)}>{t(pf(`ds_${tier.key}`))}</Text>
              </Badge>
              <Text className="text-sm">
                {t(pf('ds_total_penalty'))}: <Text className={cn('text-sm', r.total_delta < 0 ? 'font-semibold text-destructive' : 'text-success')}>{r.total_delta < 0 ? r.total_delta : '+0'}</Text>
              </Text>
              <Text className="text-sm">
                {t(pf('ds_referrals'))}: {r.referral_count}
              </Text>
            </View>
          </View>
          {r.breakdown.length ? (
            <View>
              <View className="flex-row items-center gap-1.5 pb-1">
                <Icon as={TrendingDown} className="size-4 text-destructive" />
                <Text className="text-sm font-semibold">{t(pf('ds_breakdown'))}</Text>
              </View>
              {r.breakdown.map((b, i) => (
                <View key={i}>
                  <Separator />
                  <View className="flex-row items-start gap-3 py-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{b.field_name}</Text>
                      <Text className="text-muted-foreground text-xs">{b.detail}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-muted-foreground text-xs">{formatDate(b.incident_date)}</Text>
                      <Text className="text-sm font-semibold text-destructive">{b.delta}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-2">
              <Text className="text-sm">{t(pf('ds_none'))}</Text>
              <Text className="text-muted-foreground text-xs">{t(pf('ds_full'))}</Text>
            </View>
          )}
        </View>
      )}
    </InfoCard>
  );
}

// ── Relatives ────────────────────────────────────────────────────────────────

/** Linked parents and siblings (web: RelativesTab, also the list's Family dialog). */
export function RelativesCard({ studentId, onOpenSibling }: { studentId: string; onOpenSibling?: (studentNumber: string) => void }) {
  const { t } = useTranslation();
  const res = useApi(['admin', 'student-relatives', studentId], ([, , s]) => adminStudents.relatives(s as string));
  const name = (x: { first_name: string | null; father_name?: string | null; last_name: string | null }) => [x.first_name, x.father_name, x.last_name].filter(Boolean).join(' ') || t(pf('unknown'));
  return (
    <InfoCard title={t('school.students.student_details.tab_relatives')}>
      {res.isLoading ? (
        <LoadingList rows={2} />
      ) : (
        <View className="gap-2 py-2">
          <Text className="text-sm font-semibold">{t(pf('rel_parents'))}</Text>
          {!(res.data?.parents ?? []).length ? <Text className="text-muted-foreground text-sm">{t(pf('rel_no_parents'))}</Text> : null}
          {(res.data?.parents ?? []).map((p) => (
            <View key={p.id} className="gap-0.5">
              <Text className="text-sm font-medium">
                {name(p)} <Text className="text-muted-foreground text-xs">{t(pf(`rel_${['father', 'mother', 'guardian'].includes(p.relation_type) ? p.relation_type : 'other'}`))}{p.relationship ? ` (${p.relationship})` : ''}</Text>
              </Text>
              <Text className="text-muted-foreground text-xs">{[p.phone, p.email].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
          <Separator />
          <Text className="text-sm font-semibold">{t(pf('rel_siblings'))}</Text>
          {!(res.data?.siblings ?? []).length ? <Text className="text-muted-foreground text-sm">{t(pf('rel_no_siblings'))}</Text> : null}
          {(res.data?.siblings ?? []).map((s) => (
            <Pressable key={s.id} disabled={!onOpenSibling || !s.student_number} onPress={() => s.student_number && onOpenSibling?.(s.student_number)} className="flex-row items-center gap-2 py-1">
              <Text className={cn('flex-1 text-sm', onOpenSibling && 'text-primary')}>{name(s)}</Text>
              <Text className="text-muted-foreground text-xs">{s.grade_level || '—'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </InfoCard>
  );
}

// ── Reassign grade & section ─────────────────────────────────────────────────

/** Move a student to another grade level / section with seats left (web: ReassignGradeSectionDialog). */
export function ReassignPanel({ studentId, gradeId, sectionId, onDone, onCancel }: { studentId: string; gradeId?: string | null; sectionId?: string | null; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const d = (k: string) => t(`school.students.student_details.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [grade, setGrade] = useState(gradeId ?? '');
  const [section, setSection] = useState(sectionId ?? '');
  const sections = useApi(grade ? ['admin', 'sections', campusId ?? 'school', grade] : null, ([, , c, g]) => adminAcademics.sections(c === 'school' ? undefined : (c as string), g as string));
  const [saving, setSaving] = useState(false);
  const seats = (s: { capacity?: number | null; current_strength?: number | null; available_seats?: number | null }) => s.available_seats ?? (s.capacity ?? 0) - (s.current_strength ?? 0);
  const list = (sections.data ?? []).filter((s) => s.is_active !== false && (s.id === sectionId || seats(s) > 0));

  async function save() {
    if (!grade) return;
    setSaving(true);
    try {
      const r = await adminStudents.update(campusId, studentId, { grade_level_id: grade, grade_level: (grades.data ?? []).find((g) => g.id === grade)?.name, section_id: section || null });
      if (!r.success) return toast.error(r.error || d('reassign_error_generic'));
      toast.success(d('reassign_success'));
      onDone();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardContent className="gap-2 pt-4">
        <Text className="font-semibold">{d('reassign_title')}</Text>
        <Text className="text-muted-foreground text-xs">{d('reassign_desc')}</Text>
        <Label>{d('grade_level')}</Label>
        <Picker
          value={grade}
          onChange={(v) => {
            setGrade(v);
            setSection('');
          }}
          options={(grades.data ?? []).filter((g) => g.is_active !== false).map((g) => ({ value: g.id, label: g.name }))}
        />
        <Label>{d('section')}</Label>
        <Picker value={section || '__none__'} onChange={(v) => setSection(v === '__none__' ? '' : v)} options={[{ value: '__none__', label: d('unassigned') }, ...list.map((s) => ({ value: s.id, label: `${s.name} (${seats(s)} ${d('seats_available')})` }))]} />
        <View className="flex-row gap-2 pt-1">
          <Button variant="outline" className="flex-1" onPress={onCancel} disabled={saving}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={save} disabled={saving || !grade}>
            <Text>{t('common.save')}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}

// ── Permissions on create ────────────────────────────────────────────────────

type PermissionsRole = 'staff' | 'teacher' | 'librarian' | 'student' | 'parent';

/** "Permissions" picker on the add forms: Default = full access, or a User Profile role (web: PermissionsSelect). */
export function PermissionsSelect({ baseRole, value, onChange }: { baseRole: PermissionsRole; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const roles = useApi(['admin', 'user-roles'], () => adminUserProfiles.roles());
  return (
    <View className="gap-1.5">
      <Label>{t(pf('perm_label'))}</Label>
      <Picker value={value || 'default'} onChange={onChange} options={[{ value: 'default', label: t('school.students.student_details.access_role_default') }, ...(roles.data ?? []).filter((r) => r.base_role === baseRole).map((r) => ({ value: r.id, label: r.name }))]} />
      <Text className="text-muted-foreground text-xs">{t(pf('perm_hint'))}</Text>
    </View>
  );
}

/** Give a just-created person the chosen role; returns an error message or null (web: applyPermissionProfile). */
export async function applyPermissionProfile(baseRole: PermissionsRole, roleId: string, entityId: string | undefined | null) {
  if (!roleId || roleId === 'default') return null;
  if (!entityId) return 'new user id missing';
  const r = baseRole === 'student' || baseRole === 'parent' ? await adminUserProfiles.cloneForEntity(roleId, baseRole, entityId) : await adminUserProfiles.cloneForStaff(roleId, entityId);
  return r.success ? null : r.error || 'Failed to assign permissions';
}
