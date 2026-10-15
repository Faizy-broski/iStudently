import type { SignerRole } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Building2, Check, Clock, FileDown, FileText, PenLine, ShieldCheck, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { reportPdfHtml } from '@/features/inspector/report-pdf';
import { adminInspections, inspector } from '@/lib/api';
import { pdfFile } from '@/lib/print';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const ROLES: SignerRole[] = ['teacher', 'principal', 'inspector'];

/**
 * One inspection report: signatures by role and e-signing (web: /admin/inspections/reports/[id]/sign).
 * The inspector who wrote it may also render and upload the PDF (web: InspectionReportView allowGeneratePdf).
 */
export default function InspectionReportSign() {
  const { t, i18n } = useTranslation();
  const r = (k: string) => t(`inspections.reports.${k}`);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const myId = profile?.id ?? null;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const res = useApi(['admin', 'inspection-report', id], ([, , rid]) => adminInspections.report(rid as string));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (res.isLoading) return <LoadingList rows={3} />;
  const rep = res.data;
  if (!rep) return <ErrorState message={r('report_not_found')} onRetry={() => res.mutate()} />;

  const byRole = new Map(rep.signatures.map((s) => [s.signer_role, s]));
  const isTeacher = myId === rep.teacher_profile_id;
  const isInspector = myId === rep.inspector_profile_id;
  const canSign = isTeacher || isInspector || isAdmin;
  const signedByMe = (isTeacher && byRole.has('teacher')) || (isInspector && byRole.has('inspector')) || (isAdmin && byRole.has('principal') && !isTeacher && !isInspector);

  async function viewPdf() {
    setViewing(true);
    try {
      const u = await adminInspections.reportPdfUrl(id);
      if (!u.success || !u.data) return toast.error(u.error || t('app.error_title'));
      Linking.openURL(u.data.url);
    } finally {
      setViewing(false);
    }
  }

  async function generatePdf() {
    if (!rep) return;
    setGenerating(true);
    try {
      const [ev, notes] = await Promise.all([inspector.evaluation(rep.evaluation_id), inspector.notes(rep.evaluation_id)]);
      if (!ev.success || !ev.data) return toast.error(ev.error || r('err_generate_failed'));
      const uri = await pdfFile(reportPdfHtml({ report: rep, evaluation: ev.data, notes: notes.data ?? [], t, locale: i18n.language }));
      const up = await inspector.uploadReportPdf(id, { uri, name: `inspection-report-${id}.pdf`, type: 'application/pdf' });
      if (!up.success) return toast.error(up.error || r('err_generate_failed'));
      toast.success(r('msg_pdf_generated'));
      res.mutate();
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : r('err_generate_failed'));
    } finally {
      setGenerating(false);
    }
  }

  async function sign() {
    if (!password || !name.trim()) return;
    setSigning(true);
    try {
      const s = await adminInspections.signReport(id, password, name.trim());
      if (!s.success) return toast.error(s.error || t('app.error_title'));
      toast.success(r('msg_signed'));
      setOpen(false);
      setPassword('');
      setName('');
      res.mutate();
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: r('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader className="gap-2">
            <View className="flex-row items-start gap-2">
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Building2} className="size-5 text-[#022172]" />
                  <CardTitle>{rep.school?.name}</CardTitle>
                </View>
                <CardDescription>{`${rep.teacher ? `${rep.teacher.first_name} ${rep.teacher.last_name}` : ''} · ${rep.inspector ? `${rep.inspector.first_name} ${rep.inspector.last_name}` : ''}`}</CardDescription>
              </View>
              <Badge variant={rep.status === 'fully_signed' ? 'secondary' : 'outline'}>
                <Text>{r(`status_${rep.status}`)}</Text>
              </Badge>
            </View>
          </CardHeader>
          {rep.pdf_file_url || isInspector ? (
            <CardContent className="flex-row flex-wrap gap-2">
              {isInspector ? (
                <Button size="sm" variant="outline" onPress={generatePdf} disabled={generating}>
                  <Icon as={FileText} className="text-foreground size-4" />
                  <Text>{rep.pdf_file_url ? r('btn_regenerate_pdf') : r('btn_generate_pdf')}</Text>
                </Button>
              ) : null}
              {rep.pdf_file_url ? (
                <Button size="sm" variant="outline" onPress={viewPdf} disabled={viewing}>
                  <Icon as={FileDown} className="text-foreground size-4" />
                  <Text>{r('btn_view_pdf')}</Text>
                </Button>
              ) : null}
            </CardContent>
          ) : null}
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={TrendingUp} className="size-4 text-[#022172]" />
            <CardTitle>{r('signatures_title')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {ROLES.map((role) => {
              const sig = byRole.get(role);
              return (
                <View key={role} className={cn('rounded-md border p-3', sig ? 'border-green-200 bg-green-50' : 'border-border')}>
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <Icon as={sig ? Check : Clock} className={cn('size-3.5', sig ? 'text-green-600' : 'text-muted-foreground')} />
                    <Text className="text-muted-foreground text-xs font-medium">{r(`role_${role}`)}</Text>
                  </View>
                  {sig ? (
                    <>
                      <Text className="text-sm">{sig.typed_full_name}</Text>
                      <Text className="text-muted-foreground text-[11px]">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sig.attested_at))}</Text>
                    </>
                  ) : (
                    <Text className="text-muted-foreground text-sm">{r('pending_signature')}</Text>
                  )}
                </View>
              );
            })}
            {canSign && !signedByMe ? (
              <Button onPress={() => setOpen(true)}>
                <Icon as={PenLine} className="text-primary-foreground size-4" />
                <Text>{r('btn_sign')}</Text>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </ScrollView>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <View className="flex-row items-center gap-2">
              <Icon as={ShieldCheck} className="size-5 text-[#022172]" />
              <DialogTitle>{r('dialog_sign_title')}</DialogTitle>
            </View>
            <DialogDescription>{r('dialog_sign_desc')}</DialogDescription>
          </DialogHeader>
          <View className="gap-3">
            <View className="gap-1.5">
              <Label>{r('field_typed_name')}</Label>
              <Input value={name} onChangeText={setName} placeholder={r('field_typed_name_placeholder')} />
            </View>
            <View className="gap-1.5">
              <Label>{r('field_password')}</Label>
              <Input value={password} onChangeText={setPassword} placeholder={r('field_password_placeholder')} secureTextEntry autoCapitalize="none" />
            </View>
          </View>
          <DialogFooter>
            <Button onPress={sign} disabled={signing || !password || !name.trim()}>
              <Icon as={PenLine} className="text-primary-foreground size-4" />
              <Text>{r('btn_confirm_sign')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
