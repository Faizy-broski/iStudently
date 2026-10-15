import type { Student } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Download, Printer, QrCode, RefreshCw, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import QRCode from 'react-qr-code';

import { ScrollView } from '@/components/app/keyboard';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMiqat, adminStudents } from '@/lib/api';
import { escapeHtml, printHtml, qrSvg, sharePdf } from '@/lib/print';

type Issued = { personId: string; name: string; qrPayload: string; revision: number };

const fullName = (s: Student) => [s.profile?.first_name, s.profile?.father_name, s.profile?.grandfather_name, s.profile?.last_name].filter(Boolean).join(' ');
const personIdOf = (s: Student) => s.profile_id || s.profile?.id || s.id;

/** Issue or re-issue a student's Miqat QR card, then print or share it (web: /admin/miqat/cards). */
export default function MiqatCards() {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`miqat.cards.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      // The server matches each name column separately, so only the first word is sent (same as the web).
      const res = await adminStudents.list(campusId, { search: query.trim().split(/\s+/)[0], limit: 20 });
      if (!res.success) toast.error(res.error || c('searchError'));
      setResults(res.success ? (res.data ?? []) : []);
    } finally {
      setSearching(false);
    }
  }

  async function issue(s: Student, reissue: boolean) {
    const pid = personIdOf(s);
    setIssuing(pid);
    try {
      const res = reissue ? await adminMiqat.reportCardLost(pid, campusId) : await adminMiqat.issueCard(pid, campusId);
      if (!res.success || !res.data) return toast.error(res.error || c('issueError'));
      if (res.data.signing_key_error) return toast.error(res.data.signing_key_error);
      setIssued({ personId: pid, name: fullName(s), qrPayload: res.data.qr_payload ?? '', revision: res.data.revision });
    } finally {
      setIssuing(null);
    }
  }

  const cardHtml = (x: Issued) => {
    const rtl = i18n.language === 'ar';
    return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}.qr{width:260px;height:260px;margin:16px auto}.qr svg{width:100%;height:100%}h1{font-size:20px;margin:0}p{color:#555;font-size:13px}</style></head><body><h1>${escapeHtml(x.name)}</h1><div class="qr">${qrSvg(x.qrPayload)}</div><p>${escapeHtml(c('revisionLabel'))}: ${x.revision}</p></body></html>`;
  };

  async function run(fn: () => Promise<void>, errorKey: string) {
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : c(errorKey));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row gap-2">
              <Input className="flex-1" value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" placeholder={c('searchPlaceholder')} />
              <Button onPress={search} disabled={searching}>
                <Icon as={Search} className="text-primary-foreground size-4" />
              </Button>
            </View>
            {results && results.length === 0 && !searching ? <Text variant="muted" className="p-2 text-sm">{c('noResults')}</Text> : null}
            {(results ?? []).map((s, i) => {
              const pid = personIdOf(s);
              return (
                <View key={pid}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-2 py-3">
                    <Text>{fullName(s) || s.student_number}</Text>
                    <View className="flex-row gap-2">
                      <Button size="sm" variant="outline" disabled={issuing === pid} onPress={() => issue(s, false)}>
                        <Icon as={QrCode} className="text-foreground size-4" />
                        <Text>{c('issue')}</Text>
                      </Button>
                      <Button size="sm" variant="ghost" disabled={issuing === pid} onPress={() => issue(s, true)}>
                        <Icon as={RefreshCw} className="text-foreground size-4" />
                        <Text>{c('reissueLost')}</Text>
                      </Button>
                    </View>
                  </View>
                </View>
              );
            })}
          </CardContent>
        </Card>

        {issued ? (
          <Card>
            <CardContent className="items-center gap-4 pt-6">
              <Text className="text-lg font-semibold">{issued.name}</Text>
              <Text variant="muted" className="text-sm">{`${c('revisionLabel')}: ${issued.revision}`}</Text>
              <View className="border-border rounded-lg border bg-white p-4">
                <QRCode value={issued.qrPayload} size={200} bgColor="#FFFFFF" fgColor="#000000" />
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" onPress={() => run(() => printHtml(cardHtml(issued)), 'printError')}>
                  <Icon as={Printer} className="text-foreground size-4" />
                  <Text>{c('print')}</Text>
                </Button>
                <Button variant="outline" onPress={() => run(() => sharePdf(cardHtml(issued), `miqat-card-${issued.personId}.pdf`), 'downloadError')}>
                  <Icon as={Download} className="text-foreground size-4" />
                  <Text>{c('download')}</Text>
                </Button>
              </View>
              <Text className="text-muted-foreground max-w-sm text-center text-xs">{c('printNotice')}</Text>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
