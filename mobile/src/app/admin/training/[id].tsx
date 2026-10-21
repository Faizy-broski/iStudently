import type { TrainingAudience, TrainingCertificate, TrainingPaymentStatus, TrainingRegistration, TrainingSessionStatus } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Award, Copy, Download, Pencil, QrCode, Trash2, UserCheck, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import QRCode from 'react-qr-code';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { capacityTone, registrationLink, STATUS_TONE } from '@/features/admin/training';
import { useCampus } from '@/features/campus/campus';
import { adminTraining } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Tab = 'confirmed_paid' | 'confirmed_unpaid' | 'waiting_list' | 'cancelled';
const TABS: Tab[] = ['confirmed_paid', 'confirmed_unpaid', 'waiting_list', 'cancelled'];
const PAYMENTS: TrainingPaymentStatus[] = ['unpaid', 'pending_verification', 'paid', 'expired'];

const split = (iso?: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};

/** One training session: registrations by status with payment, attendance, score, QR, certificates, waitlist (web: /admin/training/[id]). */
export default function TrainingSessionDetail() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.trn_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  const { campusId } = useCampus();
  const sess = useApi(sessionId ? ['admin', 'training-session', sessionId, campusId ?? 'school'] : null, ([, , sid]) => adminTraining.session(String(sid), campusId));
  const [tab, setTab] = useState<Tab>('confirmed_paid');
  const regs = useApi(sessionId ? ['admin', 'training-regs', sessionId, tab, campusId ?? 'school'] : null, ([, , sid, tb]) =>
    adminTraining.registrations(String(sid), tb === 'confirmed_paid' ? { status: 'confirmed', paid: true, campus_id: campusId } : tb === 'confirmed_unpaid' ? { status: 'confirmed', paid: false, campus_id: campusId } : { status: String(tb), campus_id: campusId }),
  );
  const [scores, setScores] = useState<Record<string, string>>({});
  const [qrFor, setQrFor] = useState<TrainingRegistration | null>(null);
  const [certsFor, setCertsFor] = useState<TrainingRegistration | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const s = sess.data ?? null;
  const templateId = s?.certificate_settings?.certificate_template_id ?? null;
  const day = (iso: string, withTime = false) => new Date(iso).toLocaleString(i18n.language, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
  const refresh = () => {
    regs.mutate();
    sess.mutate();
  };

  async function act<T>(key: string, fn: () => Promise<{ success: boolean; error?: string; status?: number; data?: T }>, ok?: string, fail?: string) {
    setBusy(key);
    try {
      const r = await fn();
      if (!r.success) {
        toast.error(r.error || fail || t('common.error'));
        return null;
      }
      if (ok) toast.success(ok);
      return r;
    } finally {
      setBusy(null);
    }
  }

  async function commitScore(reg: TrainingRegistration) {
    const raw = (scores[reg.id] ?? '').trim();
    if (scores[reg.id] === undefined) return;
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) return toast.error(a('score_range'));
    if (value === (reg.final_score ?? null)) return;
    if (await act(`score-${reg.id}`, () => adminTraining.setScore(reg.id, sessionId, value, campusId), undefined, a('score_failed'))) regs.mutate();
  }

  async function promote(reg: TrainingRegistration) {
    setBusy(`promote-${reg.id}`);
    try {
      const r = await adminTraining.promote(reg.id, sessionId, campusId);
      if (r.success) {
        toast.success(a('promoted'));
        refresh();
      } else toast.error(r.status === 409 || r.error?.includes('already filled') ? a('seat_filled') : r.error || a('promote_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function hardDelete(reg: TrainingRegistration) {
    if (!(await confirm({ title: a('hard_delete_title'), body: a('hard_delete_body', { name: reg.display_name ?? '' }), confirmLabel: a('hard_delete_btn'), destructive: true }))) return;
    if (await act(`del-${reg.id}`, () => adminTraining.hardDelete(reg.id, sessionId, campusId), a('hard_deleted'), a('delete_failed'))) refresh();
  }

  async function bulkIssue() {
    if (!templateId) return toast.error(a('pick_template'));
    const r = await act('bulk', () => adminTraining.bulkIssue(sessionId, campusId), undefined, a('bulk_failed'));
    if (r?.data) {
      toast.success(a('bulk_result', { issued: r.data.issued, skipped: r.data.skipped, failed: r.data.errors.length }));
      regs.mutate();
    }
  }

  async function exportCsv() {
    setBusy('export');
    try {
      await shareApiFile(adminTraining.exportPath(sessionId, campusId), `registrations-${sessionId}.csv`, 'text/csv');
    } catch {
      toast.error(a('export_failed'));
    } finally {
      setBusy(null);
    }
  }

  if (sess.isLoading) return <LoadingList />;
  if (!s) return <ErrorState message={a('not_found')} onRetry={() => sess.mutate()} />;

  const pct = s.total_seats > 0 ? Math.round((s.registered_seats / s.total_seats) * 100) : 0;
  const counts = s.registration_counts ?? { confirmed_paid: 0, confirmed_unpaid: 0, waiting_list: 0, cancelled: 0 };
  const list = regs.data ?? [];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s.title }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap items-center gap-2">
          <View className={cn('rounded px-2 py-0.5', STATUS_TONE[s.status])}>
            <Text className={cn('text-xs font-medium capitalize', STATUS_TONE[s.status])}>{s.status}</Text>
          </View>
          <View className="border-border rounded-full border px-2 py-0.5">
            <Text className="text-xs capitalize">{s.target_audience}</Text>
          </View>
        </View>
        <Text className="text-muted-foreground text-sm">
          {day(s.start_date, true)} – {day(s.end_date, true)}
          {s.course_fee > 0 ? ` · ${a('fee', { fee: s.course_fee.toFixed(2) })}` : ''}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => setEditOpen(true)}>
            <Icon as={Pencil} className="text-foreground size-4" />
            <Text>{t('common.edit')}</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={async () => {
              await Clipboard.setStringAsync(registrationLink(s.public_token));
              toast.success(a('link_copied'));
            }}>
            <Icon as={Copy} className="text-foreground size-4" />
            <Text>{a('copy_link')}</Text>
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'export'} onPress={exportCsv}>
            <Icon as={Download} className="text-foreground size-4" />
            <Text>{a('export_csv')}</Text>
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk' || !templateId} onPress={bulkIssue}>
            <Icon as={Award} className="text-foreground size-4" />
            <Text>{a('bulk_issue')}</Text>
          </Button>
        </View>
        {!templateId ? <Text className="text-muted-foreground text-xs">{a('pick_template')}</Text> : null}

        <Card>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row justify-between">
              <Text className="text-sm">{a('seats_taken', { registered: s.registered_seats, total: s.total_seats })}</Text>
              <Text className="text-muted-foreground text-sm">{a('remaining', { count: s.available_seats })}</Text>
            </View>
            <View className="bg-muted h-2 overflow-hidden rounded-full">
              <View className={cn('h-full rounded-full', capacityTone(pct))} style={{ width: `${pct}%` }} />
            </View>
            <View className="flex-row flex-wrap gap-x-4">
              {TABS.map((k) => (
                <Text key={k} className="text-muted-foreground text-xs">
                  {a(`tab_${k}`)}: {counts[k]}
                </Text>
              ))}
            </View>
          </CardContent>
        </Card>

        <FilterChips value={tab} onChange={setTab} options={TABS.map((k) => ({ value: k, label: `${a(`tab_${k}`)} (${counts[k]})` }))} />

        {regs.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState title={a('no_registrations')} />
        ) : (
          list.map((reg) => (
            <Card key={reg.id}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-sm font-semibold">{reg.display_name ?? '—'}</Text>
                  <StatusChip label={a(`type_${reg.student_type}`)} tone={reg.student_type === 'internal' ? 'info' : 'warning'} />
                </View>
                <Text className="text-muted-foreground text-xs">
                  {a('contact')}: {reg.ext_parent_phone ?? '—'} · {a('registered')}: {day(reg.created_at)}
                </Text>
                <View className="gap-1">
                  <Label className="text-xs">{a('payment')}</Label>
                  <Picker
                    value={reg.payment_status}
                    onChange={async (v) => {
                      if (await act(`pay-${reg.id}`, () => adminTraining.setPayment(reg.id, sessionId, v as TrainingPaymentStatus, campusId), undefined, a('payment_failed'))) refresh();
                    }}
                    options={PAYMENTS.map((p) => ({ value: p, label: a(`pay_${p}`) }))}
                  />
                </View>
                <View className="flex-row items-center gap-4">
                  <View className="flex-row items-center gap-2">
                    <Switch
                      checked={reg.attendance_status}
                      onCheckedChange={async () => {
                        if (await act(`att-${reg.id}`, () => adminTraining.toggleAttendance(reg.id, sessionId, campusId), undefined, a('attendance_failed'))) regs.mutate();
                      }}
                    />
                    <Text className="text-sm">{reg.attendance_status ? a('present') : a('absent')}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm">{a('score')}</Text>
                    <Input
                      className="w-20"
                      keyboardType="decimal-pad"
                      value={scores[reg.id] ?? (reg.final_score != null ? String(reg.final_score) : '')}
                      onChangeText={(v) => setScores((p) => ({ ...p, [reg.id]: v }))}
                      onBlur={() => commitScore(reg)}
                    />
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" variant="outline" onPress={() => setQrFor(reg)}>
                    <Icon as={QrCode} className="text-foreground size-4" />
                    <Text>{a('qr')}</Text>
                  </Button>
                  {tab !== 'waiting_list' && tab !== 'cancelled' ? (
                    <Button size="sm" variant="outline" onPress={() => setCertsFor(reg)}>
                      <Icon as={Award} className="text-foreground size-4" />
                      <Text>{a('certificates')}</Text>
                    </Button>
                  ) : null}
                  {tab === 'waiting_list' ? (
                    <Button size="sm" variant="outline" disabled={busy === `promote-${reg.id}`} onPress={() => promote(reg)}>
                      <Icon as={UserCheck} className="text-foreground size-4" />
                      <Text>{a('promote')}</Text>
                    </Button>
                  ) : null}
                  {tab !== 'cancelled' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={async () => {
                        if (await act(`cancel-${reg.id}`, () => adminTraining.cancel(reg.id, sessionId, campusId), a('cancelled'), a('cancel_failed'))) refresh();
                      }}>
                      <Icon as={X} className="text-foreground size-4" />
                      <Text>{a('cancel_reg')}</Text>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onPress={() => hardDelete(reg)} accessibilityLabel={a('hard_delete_btn')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="w-[90vw] max-w-sm items-center">
          <DialogHeader>
            <DialogTitle>{qrFor?.display_name ?? a('qr')}</DialogTitle>
          </DialogHeader>
          {qrFor ? (
            <View className="items-center gap-2 rounded-lg bg-white p-4">
              <QRCode value={qrFor.qr_auth_token} size={200} />
              <Text className="font-mono text-xs text-black">{qrFor.qr_auth_token.slice(0, 12)}…</Text>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>

      <CertificatesDialog reg={certsFor} sessionId={sessionId} campusId={campusId} templateId={templateId} onClose={() => setCertsFor(null)} onIssued={() => regs.mutate()} />
      <EditDialog
        open={editOpen}
        session={{ title: s.title, description: s.description ?? '', start: s.start_date, end: s.end_date, seats: s.total_seats, fee: s.course_fee, audience: s.target_audience, status: s.status }}
        onClose={() => setEditOpen(false)}
        onSave={async (body) => {
          const r = await act('edit', () => adminTraining.update(sessionId, body, campusId), a('updated'), a('update_failed'));
          if (r) {
            setEditOpen(false);
            sess.mutate();
          }
        }}
      />
    </View>
  );
}

function CertificatesDialog({ reg, sessionId, campusId, templateId, onClose, onIssued }: { reg: TrainingRegistration | null; sessionId: string; campusId?: string; templateId: string | null; onClose: () => void; onIssued: () => void }) {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.trn_${k}`, o);
  const toast = useToast();
  const regId = reg?.id ?? null;
  const certs = useApi(regId ? ['admin', 'training-certs', regId] : null, ([, , rid]) => adminTraining.certificates(String(rid), sessionId, campusId));
  const [issuing, setIssuing] = useState(false);
  async function issue() {
    if (!regId) return;
    if (!templateId) return toast.error(a('pick_template'));
    setIssuing(true);
    try {
      const r = await adminTraining.issueCertificate(regId, sessionId, templateId, campusId);
      if (!r.success) return toast.error(r.error || a('issue_failed'));
      toast.success(a('issued'));
      certs.mutate();
      onIssued();
    } finally {
      setIssuing(false);
    }
  }
  const list: TrainingCertificate[] = certs.data ?? [];
  return (
    <Dialog open={!!reg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{a('certificates')}</DialogTitle>
        </DialogHeader>
        {certs.isLoading ? (
          <LoadingList rows={2} />
        ) : !list.length ? (
          <Text className="text-muted-foreground text-sm">{a('no_certificates')}</Text>
        ) : (
          list.map((c) => (
            <View key={c.id} className="border-info-soft dark:border-border flex-row items-center gap-2 rounded-xl border p-2">
              <View className="flex-1">
                <Text className="font-mono text-xs">{c.verification_code}</Text>
                <Text className="text-muted-foreground text-xs">{new Date(c.issued_at).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}</Text>
                {c.delivery_email_error ? <Text className="text-destructive text-xs">{c.delivery_email_error}</Text> : null}
              </View>
              {c.download_url ? (
                <Button size="sm" variant="ghost" onPress={() => Linking.openURL(c.download_url ?? '')}>
                  <Text>{a('download')}</Text>
                </Button>
              ) : null}
            </View>
          ))
        )}
        <Button disabled={issuing || !templateId} onPress={issue}>
          <Icon as={Award} className="text-primary-foreground size-4" />
          <Text>{a('issue_new')}</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

type EditValues = { title: string; description: string; start: string; end: string; seats: number; fee: number; audience: TrainingAudience; status: TrainingSessionStatus };

function EditDialog({ open, session, onClose, onSave }: { open: boolean; session: EditValues; onClose: () => void; onSave: (body: { title: string; description?: string; start_date: string; end_date: string; total_seats: number; course_fee: number; target_audience: TrainingAudience; status: TrainingSessionStatus }) => void }) {
  const { t } = useTranslation();
  const a = (k: string) => t(`app.trn_${k}`);
  const toast = useToast();
  const [v, setV] = useState({ title: '', description: '', sd: '', st: '', ed: '', et: '', seats: '', fee: '', audience: 'both' as TrainingAudience, status: 'open' as TrainingSessionStatus });
  useEffect(() => {
    if (!open) return;
    const s = split(session.start);
    const e = split(session.end);
    setV({ title: session.title, description: session.description, sd: s.date, st: s.time, ed: e.date, et: e.time, seats: String(session.seats), fee: String(session.fee), audience: session.audience, status: session.status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  function submit() {
    const start = new Date(`${v.sd}T${v.st || '00:00'}:00`);
    const end = new Date(`${v.ed}T${v.et || '00:00'}:00`);
    if (v.title.trim().length < 2 || !v.sd || !v.ed || !(parseInt(v.seats, 10) >= 1)) return toast.error(t('app.trn_err_required'));
    if (start >= end) return toast.error(t('app.trn_err_order'));
    onSave({ title: v.title, description: v.description || undefined, start_date: start.toISOString(), end_date: end.toISOString(), total_seats: parseInt(v.seats, 10), course_fee: Number(v.fee) || 0, target_audience: v.audience, status: v.status });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{a('edit_session')}</DialogTitle>
        </DialogHeader>
        <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          <Label>{a('f_title')}</Label>
          <Input value={v.title} onChangeText={(x) => setV((p) => ({ ...p, title: x }))} />
          <Label>{a('f_description')}</Label>
          <Textarea value={v.description} onChangeText={(x) => setV((p) => ({ ...p, description: x }))} />
          <Label>{a('f_start')}</Label>
          <View className="flex-row gap-2">
            <DateField className="flex-1" value={v.sd} onChange={(x) => setV((p) => ({ ...p, sd: x }))} />
            <TimeField className="w-32" value={v.st} onChange={(x) => setV((p) => ({ ...p, st: x }))} />
          </View>
          <Label>{a('f_end')}</Label>
          <View className="flex-row gap-2">
            <DateField className="flex-1" value={v.ed} onChange={(x) => setV((p) => ({ ...p, ed: x }))} />
            <TimeField className="w-32" value={v.et} onChange={(x) => setV((p) => ({ ...p, et: x }))} />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Label>{a('f_seats')}</Label>
              <Input value={v.seats} keyboardType="number-pad" onChangeText={(x) => setV((p) => ({ ...p, seats: x.replace(/\D/g, '') }))} />
            </View>
            <View className="flex-1 gap-1">
              <Label>{a('f_fee')}</Label>
              <Input value={v.fee} keyboardType="decimal-pad" onChangeText={(x) => setV((p) => ({ ...p, fee: x.replace(/[^0-9.]/g, '') }))} />
            </View>
          </View>
          <Label>{a('f_audience')}</Label>
          <Picker value={v.audience} onChange={(x) => setV((p) => ({ ...p, audience: x as TrainingAudience }))} options={(['internal', 'external', 'both'] as const).map((x) => ({ value: x, label: a(`aud_${x}`) }))} />
          <Label>{a('f_status')}</Label>
          <Picker value={v.status} onChange={(x) => setV((p) => ({ ...p, status: x as TrainingSessionStatus }))} options={(['open', 'full', 'closed'] as const).map((x) => ({ value: x, label: t(`adminTrainingSessions.status${x[0].toUpperCase()}${x.slice(1)}`) }))} />
        </ScrollView>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={submit}>
            <Text>{t('common.save')}</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
