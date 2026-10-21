import type { AgreementItem, AgreementReportRow, AgreementRole, RoleAgreementConfig, RoleAgreementConfigs } from '@studently/api-client';
import { toCsv, todayIso } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { BarChart3, CalendarClock, CheckCircle2, Clock, FileText, Info, Plus, RefreshCw, Save, Share2, ToggleRight, Trash2, Users, XCircle, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { RichTextField } from '@/components/app/rich-text-field';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { plainMessage } from '@/i18n/plain';
import { agreement } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const ROLE_IDS: AgreementRole[] = ['student', 'teacher', 'parent', 'staff', 'librarian', 'counselor'];

const emptyConfig = (): RoleAgreementConfig => ({ enabled: false, reset_mode: 'manual', block_linked_students: false, agreements: [] });

const newId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Per-role sign-in agreements for the selected campus, reset of acceptances, and the acceptance report (web: /admin/settings/user-agreements). */
export default function UserAgreementsSettings() {
  const { t, i18n } = useTranslation();
  const u = (k: string, o?: Record<string, unknown>) => t(`school.user_agreements.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'agreement-config', campusId ?? 'school'], () => agreement.config(campusId));
  const [configs, setConfigs] = useState<RoleAgreementConfigs>({});
  const [tab, setTab] = useState<AgreementRole>('student');
  const [langs, setLangs] = useState<Record<string, 'ar' | 'en'>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<AgreementRole | null>(null);
  const [reportRole, setReportRole] = useState<AgreementRole>('student');
  const report = useApi(['admin', 'agreement-report', reportRole, campusId ?? 'school'], ([, , role]) => agreement.report(role as AgreementRole, campusId));

  useEffect(() => {
    if (res.data) setConfigs(res.data);
  }, [res.data]);

  const roleLabel = (r: AgreementRole) => u(`roles.${r}`);
  const getRole = (role: AgreementRole): RoleAgreementConfig => ({ ...emptyConfig(), ...configs[role], agreements: configs[role]?.agreements ?? [] });
  const setRole = (role: AgreementRole, patch: Partial<RoleAgreementConfig>) => setConfigs((p) => ({ ...p, [role]: { ...emptyConfig(), ...p[role], ...patch } }));
  const updateItem = (role: AgreementRole, id: string, patch: Partial<AgreementItem>) =>
    setConfigs((p) => {
      const cfg = { ...emptyConfig(), ...p[role], agreements: p[role]?.agreements ?? [] };
      return { ...p, [role]: { ...cfg, agreements: cfg.agreements.map((a) => (a.id === id ? { ...a, ...patch } : a)) } };
    });

  async function save() {
    setSaving(true);
    try {
      const r = await agreement.saveConfig(configs, campusId);
      if (!r.success) return toast.error(r.error || u('save_failed'));
      toast.success(u('saved'));
      res.mutate();
    } catch {
      toast.error(u('unexpected_error'));
    } finally {
      setSaving(false);
    }
  }

  async function resetAcceptances(role: AgreementRole) {
    const label = roleLabel(role);
    if (!(await confirm({ title: u('reset_dialog_title', { role: label }), body: u('reset_dialog_desc', { role: label.toLowerCase() }), confirmLabel: u('reset_acceptances') }))) return;
    setResetting(role);
    try {
      const r = await agreement.resetAcceptances(role);
      if (!r.success) return toast.error(r.error || u('reset_failed'));
      toast.success(r.message || u('reset_success', { role: label }));
      report.mutate();
    } catch {
      toast.error(u('unexpected_error'));
    } finally {
      setResetting(null);
    }
  }

  const rows: AgreementReportRow[] = report.data ?? [];
  const statusLabel = (s: AgreementReportRow['status']) => (s === 'accepted' ? u('status_accepted') : s === 'rejected' ? u('status_rejected') : u('status_pending'));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(i18n.language) : '—');

  async function downloadCsv() {
    const csv = toCsv(
      [u('report_name'), u('report_email'), u('report_status'), u('report_active'), u('report_date')],
      rows.map((r) => [r.name, r.email, statusLabel(r.status), r.is_active ? u('account_active') : u('account_inactive'), r.updated_at ? fmtDate(r.updated_at) : '-']),
    );
    await shareTextFile(`agreement-report-${reportRole}-${todayIso()}.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
  }

  if (res.isLoading) return <LoadingList />;

  const section = (icon: LucideIcon, title: string, desc: string | null, right: ReactNode, children?: ReactNode, dim = false) => (
    <Card className={dim ? 'opacity-50' : ''} pointerEvents={dim ? 'none' : 'auto'}>
      <CardContent className="gap-4 pt-4">
        <View className="flex-row items-start gap-2">
          <Icon as={icon} className="text-muted-foreground mt-0.5 size-4" />
          <View className="flex-1">
            <Text className="font-semibold">{title}</Text>
            {desc ? <Text className="text-muted-foreground text-sm">{desc}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </CardContent>
    </Card>
  );

  const radio = (role: AgreementRole, value: 'manual' | 'annual', title: string, desc: string) => {
    const on = (getRole(role).reset_mode ?? 'manual') === value;
    return (
      <Pressable onPress={() => setRole(role, { reset_mode: value })} accessibilityRole="radio" accessibilityState={{ checked: on }} className="flex-row items-start gap-3">
        <View className={cn('border-primary mt-0.5 size-5 items-center justify-center rounded-full border-2')}>{on ? <View className="bg-primary size-2.5 rounded-full" /> : null}</View>
        <View className="flex-1">
          <Text className="text-sm font-semibold">{title}</Text>
          <Text className="text-muted-foreground text-xs">{desc}</Text>
        </View>
      </Pressable>
    );
  };

  const pill = (icon: LucideIcon, label: string, n: number, cls: string, textCls: string) => (
    <View className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${cls}`}>
      <Icon as={icon} className={`size-3.5 ${textCls}`} />
      <Text className={`text-sm ${textCls}`}>
        <Text className={`text-sm font-medium ${textCls}`}>{label}:</Text> {n}
      </Text>
    </View>
  );

  const cfg = getRole(tab);
  const infoKeys = ['info_1', 'info_2', 'info_3', 'info_4', 'info_5', 'info_6', 'info_7', 'info_8'];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: u('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{u('subtitle')}</Text>
        <Button variant="outline" size="sm" className="self-start" onPress={() => router.push('/admin/settings/parent-agreement')}>
          <Icon as={FileText} className="size-4" />
          <Text>{t('app.pag_open')}</Text>
        </Button>

        {section(
          Info,
          u('how_it_works'),
          null,
          null,
          <View className="gap-1.5">
            {infoKeys.map((k) => (
              <Text key={k} className="text-muted-foreground text-sm">
                • {plainMessage(`school.user_agreements.${k}`)}
              </Text>
            ))}
            {campusId ? <Text className="text-sm text-brand dark:text-brand-secondary">• {u('campus_specific')}</Text> : null}
          </View>,
        )}

        <FilterChips value={tab} onChange={setTab} options={ROLE_IDS.map((r) => ({ value: r, label: `${roleLabel(r)}${getRole(r).enabled ? ' ●' : ''}` }))} />

        {section(
          ToggleRight,
          u('role_agreement_title', { role: roleLabel(tab) }),
          cfg.enabled ? u('active_desc') : u('disabled_desc'),
          <View className="items-end gap-1">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setRole(tab, { enabled: v })} />
            <Text className="text-muted-foreground text-xs">{cfg.enabled ? u('enabled') : u('disabled')}</Text>
          </View>,
          <>
            {!cfg.agreements.length ? (
              <View className="border-info-soft dark:border-border items-center rounded-xl border border-dashed py-8">
                <Icon as={FileText} className="text-muted-foreground mb-2 size-8" />
                <Text className="text-muted-foreground text-sm">{u('no_agreements')}</Text>
                <Text className="text-muted-foreground mt-1 text-center text-xs">{u('no_agreements_hint')}</Text>
              </View>
            ) : (
              cfg.agreements.map((item, idx) => {
                const lang = langs[item.id] ?? 'ar';
                return (
                  <View key={item.id} className={cn('border-border gap-3 rounded-lg border p-3', !cfg.enabled && 'opacity-50')} pointerEvents={cfg.enabled ? 'auto' : 'none'}>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-muted-foreground text-sm font-semibold">{u('agreement_n', { n: idx + 1 })}</Text>
                      {!item.enabled ? (
                        <View className="rounded border border-warning/30 bg-warning-soft px-1.5 py-0.5  ">
                          <Text className="text-xs text-warning ">{u('disabled')}</Text>
                        </View>
                      ) : null}
                      <View className="flex-1" />
                      <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(tab, item.id, { enabled: v })} />
                      <Button size="sm" variant="ghost" onPress={() => setRole(tab, { agreements: cfg.agreements.filter((a) => a.id !== item.id) })}>
                        <Icon as={Trash2} className="size-3.5 text-destructive" />
                        <Text className="text-destructive">{u('remove')}</Text>
                      </Button>
                    </View>
                    <View className={cn('gap-3', !item.enabled && 'opacity-50')} pointerEvents={item.enabled ? 'auto' : 'none'}>
                      <FilterChips
                        value={lang}
                        onChange={(v) => setLangs((p) => ({ ...p, [item.id]: v }))}
                        options={[
                          { value: 'ar', label: 'العربية (Arabic)' },
                          { value: 'en', label: 'English (الإنجليزية)' },
                        ]}
                      />
                      {lang === 'ar' ? (
                        <>
                          <View className="gap-1.5">
                            <Label>العنوان (بالعربية) / Arabic Title</Label>
                            <Input value={item.title} onChangeText={(v) => updateItem(tab, item.id, { title: v })} placeholder="مثال: عقد العمل والتعيين" />
                          </View>
                          <View className="gap-1.5">
                            <Label>نص الاتفاقية (بالعربية) / Arabic Content</Label>
                            <RichTextField key={`${item.id}-ar`} value={item.content} onChange={(v) => updateItem(tab, item.id, { content: v })} />
                          </View>
                        </>
                      ) : (
                        <>
                          <View className="gap-1.5">
                            <Label>English Title / العنوان بالإنجليزية</Label>
                            <Input value={item.title_en ?? ''} onChangeText={(v) => updateItem(tab, item.id, { title_en: v })} placeholder="e.g. Employment Contract & Agreement" />
                          </View>
                          <View className="gap-1.5">
                            <Label>English Content / نص الاتفاقية بالإنجليزية</Label>
                            <RichTextField key={`${item.id}-en`} value={item.content_en ?? ''} onChange={(v) => updateItem(tab, item.id, { content_en: v })} />
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <Button variant="outline" size="sm" onPress={() => setRole(tab, { agreements: [...cfg.agreements, { id: newId(), title: '', content: '', enabled: true }] })}>
              <Icon as={Plus} className="text-foreground size-4" />
              <Text>{u('add_document')}</Text>
            </Button>
          </>,
        )}

        {section(
          CalendarClock,
          u('reset_mode_title'),
          u('reset_mode_desc'),
          null,
          <View className="gap-3">
            {radio(tab, 'manual', u('manual'), u('manual_desc'))}
            {radio(tab, 'annual', u('annual'), u('annual_desc'))}
          </View>,
          !cfg.enabled,
        )}

        {tab === 'parent'
          ? section(
              Users,
              u('block_students_title'),
              u('block_students_desc'),
              <Switch checked={cfg.block_linked_students ?? false} onCheckedChange={(v) => setRole('parent', { block_linked_students: v })} disabled={!cfg.enabled} />,
              cfg.block_linked_students ? (
                <View className="rounded-xl border border-warning/30 bg-warning-soft p-3">
                  <Text className="text-xs text-warning ">{u('block_students_warning')}</Text>
                </View>
              ) : null,
              !cfg.enabled,
            )
          : null}

        {cfg.enabled ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <View>
                <Text className="text-sm font-medium">{u('reset_acceptances')}</Text>
                <Text className="text-muted-foreground text-xs">{u('reset_all_desc', { role: roleLabel(tab).toLowerCase() })}</Text>
              </View>
              <Button variant="outline" size="sm" className="self-start" disabled={resetting === tab} onPress={() => resetAcceptances(tab)}>
                <Icon as={RefreshCw} className="text-foreground size-3.5" />
                <Text>{u('reset_acceptances')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {section(
          BarChart3,
          u('report_title'),
          u('report_desc', { role: roleLabel(reportRole) }),
          <Button variant="outline" size="icon" onPress={downloadCsv} disabled={report.isLoading || !rows.length} accessibilityLabel={u('download_csv')}>
            <Icon as={Share2} className="text-foreground size-4" />
          </Button>,
          <>
            <FilterChips value={reportRole} onChange={setReportRole} options={ROLE_IDS.map((r) => ({ value: r, label: roleLabel(r) }))} />
            {!report.isLoading && rows.length ? (
              <View className="flex-row flex-wrap gap-2">
                {pill(Users, u('total_users'), rows.length, 'bg-muted', 'text-foreground')}
                {pill(CheckCircle2, u('accepted_count'), rows.filter((r) => r.status === 'accepted').length, 'bg-success-soft ', 'text-success ')}
                {pill(XCircle, u('rejected_count'), rows.filter((r) => r.status === 'rejected').length, 'bg-destructive-soft ', 'text-destructive ')}
                {pill(Clock, u('pending_count'), rows.filter((r) => !r.status).length, 'bg-warning-soft ', 'text-warning ')}
              </View>
            ) : null}
            {report.isLoading ? (
              <View className="gap-2">
                <LoadingList rows={3} />
                <EmptyState title={u('loading_report')} />
              </View>
            ) : !rows.length ? (
              <EmptyState title={u('no_users')} />
            ) : (
              <View>
                {rows.map((row, i) => (
                  <View key={row.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="gap-1 py-2.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-sm font-semibold">{row.name || '—'}</Text>
                        <View
                          className={cn(
                            'flex-row items-center gap-1 rounded-full px-2 py-0.5',
                            row.status === 'accepted' ? 'bg-success-soft ' : row.status === 'rejected' ? 'bg-destructive-soft ' : 'bg-warning-soft ',
                          )}
                        >
                          <Icon
                            as={row.status === 'accepted' ? CheckCircle2 : row.status === 'rejected' ? XCircle : Clock}
                            className={cn('size-3', row.status === 'accepted' ? 'text-success ' : row.status === 'rejected' ? 'text-destructive ' : 'text-warning ')}
                          />
                          <Text className={cn('text-xs font-medium', row.status === 'accepted' ? 'text-success ' : row.status === 'rejected' ? 'text-destructive ' : 'text-warning ')}>
                            {statusLabel(row.status)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-muted-foreground text-xs">{row.email || '—'}</Text>
                      <View className="flex-row gap-3">
                        <Text className={cn('text-xs font-medium', row.is_active ? 'text-success ' : 'text-destructive')}>{row.is_active ? u('account_active') : u('account_inactive')}</Text>
                        <Text className="text-muted-foreground text-xs">{fmtDate(row.updated_at)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>,
        )}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? u('saving') : u('save_all')}</Text>
        </Button>
      </View>
    </View>
  );
}
