import { Stack } from 'expo-router';
import { CreditCard, Download, Printer, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { HeroCard, Section } from '@/components/app/layout';
import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ChildSwitcher, useChild } from '@/features/parent/child';
import { buildPrintHtml, escapeHtml, printHtml, qrSvg, sharePdf } from '@/lib/print';

/** A digital preview card of the selected child, printable or shareable as PDF (web: /parent/id-card). */
export default function ParentIdCard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pic_${key}`, o);
  const toast = useToast();
  const { child } = useChild();
  const [busy, setBusy] = useState(false);

  function html() {
    if (!child) return '';
    const name = `${child.first_name} ${child.last_name}`;
    const photo = child.profile_photo_url ? `<img src="${escapeHtml(child.profile_photo_url)}" style="width:80px;height:96px;object-fit:cover;border-radius:8px;background:${colors.white}"/>` : `<div style="width:80px;height:96px;border-radius:8px;background:${colors.white}"></div>`;
    const card = `<div style="width:340px;margin:24px auto;padding:24px;border-radius:12px;color:${colors.white};background:linear-gradient(135deg,${colors.brand},${colors.chart6})">
      <div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">${escapeHtml(child.campus_name)}</div><div style="font-size:11px;opacity:.8">${escapeHtml(k('identity'))}</div></div>
      <div style="display:flex;gap:16px">${photo}<div><div style="font-size:18px;font-weight:700">${escapeHtml(name)}</div><div style="font-size:13px;opacity:.9">${escapeHtml(k('id', { v: child.student_number }))}<br/>${escapeHtml(k('grade', { v: child.grade_level }))}<br/>${escapeHtml(k('section', { v: child.section }))}</div></div></div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${colors.overlayLightStrong};display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;opacity:.7">${escapeHtml(k('valid'))}</span><span style="background:${colors.white};padding:4px;border-radius:4px">${qrSvg(child.id, 2)}</span></div></div>`;
    return buildPrintHtml({ title: k('title'), school: { name: child.campus_name }, pages: [card], extraCss: '@page{margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}' });
  }

  async function download() {
    if (!child) return;
    setBusy(true);
    try {
      await sharePdf(html(), `student-id-card-${child.student_number || 'card'}.pdf`);
    } catch {
      toast.error(t('app.print_failed'));
    } finally {
      setBusy(false);
    }
  }
  async function print() {
    try {
      await printHtml(html());
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted">{k('subtitle')}</Text>
        <ChildSwitcher />
        {child ? (
          <>
            <Section title={k('preview')}>
              <View className="gap-3">
                <HeroCard>
                  <View className="mb-1 items-center">
                    <Text className="text-lg font-bold text-white">{child.campus_name}</Text>
                    <Text className="text-xs text-white/80">{k('identity')}</Text>
                  </View>
                  <View className="flex-row items-start gap-4">
                    <View className="h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-white">
                      {child.profile_photo_url ? <Image source={{ uri: child.profile_photo_url }} style={{ width: 80, height: 96 }} contentFit="cover" /> : <Icon as={User} className="size-10 text-muted-foreground" />}
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-lg font-bold text-white">{`${child.first_name} ${child.last_name}`}</Text>
                      <Text className="text-sm text-white/90">{k('id', { v: child.student_number })}</Text>
                      <Text className="text-sm text-white/90">{k('grade', { v: child.grade_level })}</Text>
                      <Text className="text-sm text-white/90">{k('section', { v: child.section })}</Text>
                    </View>
                  </View>
                  <View className="mt-1 flex-row items-center justify-between border-t border-white/30 pt-3">
                    <Text className="flex-1 text-xs text-white/70">{k('valid')}</Text>
                    <View className="rounded bg-white p-1">
                      <QRCode value={child.id} size={56} level="M" />
                    </View>
                  </View>
                </HeroCard>
                <View className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onPress={download} disabled={busy}>
                    <Icon as={Download} className="size-4" />
                    <Text>{busy ? k('downloading') : k('download')}</Text>
                  </Button>
                  <Button className="flex-1" onPress={print}>
                    <Icon as={Printer} className="text-primary-foreground size-4" />
                    <Text>{k('print')}</Text>
                  </Button>
                </View>
              </View>
            </Section>
            <View className="bg-info-soft rounded-2xl p-4">
              <Text className="text-sm text-brand dark:text-brand-secondary">{k('note')}</Text>
            </View>
          </>
        ) : (
          <EmptyState icon={CreditCard} title={k('none')} body={k('none_body')} />
        )}
      </ScrollView>
    </>
  );
}
