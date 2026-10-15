import { Stack } from 'expo-router';
import { CreditCard, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import QRCode from 'react-qr-code';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';
import { buildPrintHtml, escapeHtml, printHtml, qrSvg } from '@/lib/print';

/** Staff identity card with the verification QR, printable (web: /teacher/id-card). */
export default function TeacherIdCard() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.idCard.${key}`);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || k('teacherFallback');
  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'T';
  const qr = `${env.webUrl}/verify/${profile.id}`;
  const role = t(`app.role_${profile.role}`, { defaultValue: profile.role });

  async function print() {
    const body = `<div style="max-width:340px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #ddd">
      <div style="background:linear-gradient(135deg,#022172,#57A3CC);color:#fff;padding:20px">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.8">${escapeHtml(k('staffIdentityCard'))}</div>
        <div style="display:flex;gap:14px;align-items:center;margin-top:14px"><div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold">${escapeHtml(initials)}</div>
        <div><div style="font-size:18px;font-weight:bold">${escapeHtml(name)}</div><div style="font-size:13px;opacity:.8">${escapeHtml(role)}</div><div style="font-size:11px;opacity:.6">${escapeHtml(profile?.email ?? '')}</div></div></div>
      </div>
      <div style="padding:20px;text-align:center">${qrSvg(qr, 4)}<div style="font-size:11px;color:#666;margin-top:8px">${escapeHtml(k('scanQrToVerify'))}</div></div></div>`;
    try {
      await printHtml(buildPrintHtml({ title: k('pageTitle'), school: { name: '' }, pages: [body] }));
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="flex-row items-center gap-3">
          <Icon as={CreditCard} className="size-6 text-[#022172] dark:text-blue-400" />
          <Text variant="muted">{k('pageSubtitle')}</Text>
        </View>
        <Card className="overflow-hidden py-0">
          <View className="gap-4 bg-[#022172] p-5">
            <Text className="text-xs font-semibold tracking-widest text-white/80 uppercase">{k('staffIdentityCard')}</Text>
            <View className="flex-row items-center gap-4">
              <View className="size-16 items-center justify-center rounded-full bg-white/20">
                <Text className="text-2xl font-bold text-white">{initials}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-white">{name}</Text>
                <Text className="text-sm text-white/80">{role}</Text>
                <Text className="text-xs text-white/60">{profile.email ?? ''}</Text>
              </View>
            </View>
          </View>
          <CardContent className="items-center gap-3 p-6">
            <View className="rounded-lg bg-white p-3">
              <QRCode value={qr} size={120} bgColor="#FFFFFF" fgColor="#000000" />
            </View>
            <Text className="text-muted-foreground text-center text-xs">{k('scanQrToVerify')}</Text>
          </CardContent>
        </Card>
        <Button variant="outline" className="self-center" onPress={print}>
          <Icon as={Printer} className="size-4" />
          <Text>{k('printIdCard')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
