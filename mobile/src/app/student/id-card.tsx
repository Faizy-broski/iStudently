import type { DigitalIdCard, GeneratedIdCard, IdCardTemplateConfig } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { CreditCard, Download, Printer, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, useWindowDimensions, View, type TextStyle } from 'react-native';
import QRCode from 'react-qr-code';

import { ScrollView } from '@/components/app/keyboard';
import { HeroCard } from '@/components/app/layout';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { idCards, student } from '@/lib/api';
import { colors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml, qrSvg, sharePdf } from '@/lib/print';

type FormTemplate = Required<Pick<IdCardTemplateConfig, 'fields' | 'layout' | 'design'>> & IdCardTemplateConfig;
type FormCard = GeneratedIdCard & { template_config: FormTemplate };
const isFormCard = (card?: GeneratedIdCard | null): card is FormCard => {
  const c = card?.template_config;
  return !!c && !c.__designer && !!c.layout && !!c.design && Array.isArray(c.fields);
};
const PRINT_CSS = '@page{margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.qr svg{width:100%;height:100%;display:block}';

/** The student's ID card from the campus template, downloadable as PDF and printable (web: /student/id-card). */
export default function StudentIdCard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ic_${key}`, o);
  const p = (key: string, o?: Record<string, unknown>) => t(`app.pic_${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profileId = me.status === 'ready' ? me.me.profile.id : null;
  const { width } = useWindowDimensions();
  const card = useApi(['student', 'id-card', 'template'], () => idCards.generateStudent());
  const tpl = isFormCard(card.data) ? card.data : null;
  const basic = useApi(!card.isLoading && !tpl ? ['student', 'id-card', 'basic'] : null, () => student.getDigitalIdCard());
  const [busy, setBusy] = useState(false);

  function html() {
    const body = tpl ? templateHtml(tpl, profileId) : basic.data ? basicHtml(basic.data, p) : '';
    return buildPrintHtml({ title: k('title'), school: { name: basic.data?.school?.name ?? '' }, pages: [body], extraCss: PRINT_CSS });
  }
  async function download() {
    setBusy(true);
    try {
      await sharePdf(html(), `student-id-card-${basic.data?.student_number || 'card'}.pdf`);
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

  const loading = card.isLoading || (!tpl && basic.isLoading);
  const hasCard = !!tpl || !!basic.data;
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              card.mutate();
              basic.mutate();
            }}
          />
        }>
        <Text variant="muted">{k('subtitle')}</Text>
        {loading ? (
          <LoadingList rows={3} />
        ) : !hasCard ? (
          <EmptyState icon={CreditCard} title={k('unavailable')} body={card.error?.message} />
        ) : (
          <>
            {tpl ? <TemplateCard card={tpl} profileId={profileId} maxWidth={width - 32} /> : basic.data ? <BasicCard data={basic.data} /> : null}
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={download} disabled={busy}>
                <Icon as={Download} className="size-4" />
                <Text>{busy ? p('downloading') : k('download')}</Text>
              </Button>
              <Button className="flex-1" onPress={print}>
                <Icon as={Printer} className="text-primary-foreground size-4" />
                <Text>{k('print')}</Text>
              </Button>
            </View>
            {tpl ? (
              <View className="bg-info-soft gap-1 rounded-2xl p-4">
                <Text className="text-brand dark:text-brand-secondary font-bold">{k('template', { name: tpl.name })}</Text>
                {tpl.description ? <Text className="text-brand dark:text-brand-secondary text-sm">{tpl.description}</Text> : null}
              </View>
            ) : (
              <View className="bg-info-soft rounded-2xl p-4">
                <Text className="text-brand dark:text-brand-secondary text-sm">{card.error?.message || p('note')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

/** The template drawn at its designed size and scaled to the screen; positions are the template's own (left-to-right canvas). */
function TemplateCard({ card, profileId, maxWidth }: { card: FormCard; profileId: string | null; maxWidth: number }) {
  const c = card.template_config;
  const { width: w, height: h } = c.layout;
  const scale = Math.min(1, maxWidth / w);
  return (
    <View style={{ width: w * scale, height: h * scale, alignSelf: 'center' }}>
      <View
        style={{
          direction: 'ltr',
          position: 'absolute',
          width: w,
          height: h,
          start: -(w - w * scale) / 2,
          top: -(h - h * scale) / 2,
          transform: [{ scale }],
          backgroundColor: c.design.backgroundColor,
          borderColor: c.design.borderColor,
          borderWidth: c.design.borderWidth,
          borderRadius: c.design.borderRadius,
          overflow: 'hidden',
        }}>
        {c.design.backgroundImage ? <Image source={{ uri: c.design.backgroundImage }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" /> : null}
        {c.fields.map((f) => {
          const box = { position: 'absolute' as const, start: f.position.x, top: f.position.y, width: f.size.width, height: f.size.height };
          if (f.type === 'image') {
            return f.token ? <Image key={f.id} source={{ uri: f.token }} style={[box, { borderRadius: 4 }]} contentFit="cover" /> : <View key={f.id} style={box} />;
          }
          const align = f.style?.align === 'center' ? 'center' : f.style?.align === 'right' ? 'right' : 'left';
          return (
            <View key={f.id} style={[box, { justifyContent: 'center', alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }]}>
              <Text
                style={{
                  fontSize: f.style?.fontSize ?? 14,
                  fontFamily: plexFamily(f.style?.fontWeight),
                  color: f.style?.color || colors.black,
                  textAlign: align,
                }}>
                {f.token}
              </Text>
            </View>
          );
        })}
        {c.qrCode?.enabled && c.qrCode.data ? (
          <View style={{ position: 'absolute', start: c.qrCode.position.x, top: c.qrCode.position.y }}>
            <QRCode value={c.qrCode.data} size={c.qrCode.size} level="M" />
          </View>
        ) : profileId ? (
          <View style={{ position: 'absolute', end: 12, bottom: 12 }} className="rounded bg-white p-1">
            <QRCode value={profileId} size={64} level="M" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Card from the student record when the campus has no form-builder template. */
function BasicCard({ data }: { data: DigitalIdCard }) {
  const { t } = useTranslation();
  const p = (key: string, o?: Record<string, unknown>) => t(`app.pic_${key}`, o);
  const name = `${data.profile?.first_name ?? ''} ${data.profile?.last_name ?? ''}`.trim();
  const photo = data.profile?.photo_url ?? null;
  return (
    <HeroCard>
      <View className="mb-1 items-center">
        <Text className="text-lg font-bold text-white">{data.school?.name ?? ''}</Text>
        <Text className="text-xs text-white/80">{p('identity')}</Text>
      </View>
      <View className="flex-row items-start gap-4">
        <View className="h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-white">
          {photo ? <Image source={{ uri: photo }} style={{ width: 80, height: 96 }} contentFit="cover" /> : <Icon as={User} className="text-muted-foreground size-10" />}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-bold text-white">{name}</Text>
          <Text className="text-sm text-white/90">{p('id', { v: data.student_number })}</Text>
          <Text className="text-sm text-white/90">{p('grade', { v: data.section?.grade_level?.name ?? data.grade_level })}</Text>
          <Text className="text-sm text-white/90">{p('section', { v: data.section?.name ?? '—' })}</Text>
        </View>
      </View>
      <View className="mt-1 flex-row items-center justify-end border-t border-white/30 pt-3">
        <View className="rounded bg-white p-1">
          <QRCode value={data.profile?.id ?? data.id} size={56} level="M" />
        </View>
      </View>
    </HeroCard>
  );
}

function templateHtml(card: FormCard, profileId: string | null) {
  const c = card.template_config;
  const fields = c.fields
    .map((f) => {
      const pos = `position:absolute;left:${f.position.x}px;top:${f.position.y}px;width:${f.size.width}px;height:${f.size.height}px;`;
      if (f.type === 'image') return f.token ? `<img src="${escapeHtml(f.token)}" style="${pos}object-fit:cover;border-radius:4px"/>` : '';
      const al = f.style?.align === 'center' ? 'center' : f.style?.align === 'right' ? 'flex-end' : 'flex-start';
      return `<div style="${pos}display:flex;align-items:center;justify-content:${al};text-align:${escapeHtml(f.style?.align || 'left')};font-size:${f.style?.fontSize ?? 14}px;font-weight:${escapeHtml(f.style?.fontWeight || 'normal')};color:${escapeHtml(f.style?.color || colors.black)}">${escapeHtml(f.token)}</div>`;
    })
    .join('');
  const qr =
    c.qrCode?.enabled && c.qrCode.data
      ? `<div class="qr" style="position:absolute;left:${c.qrCode.position.x}px;top:${c.qrCode.position.y}px;width:${c.qrCode.size}px;height:${c.qrCode.size}px">${qrSvg(c.qrCode.data, 2)}</div>`
      : profileId
        ? `<div class="qr" style="position:absolute;right:12px;bottom:12px;width:64px;height:64px;padding:4px;background:${colors.white};border-radius:4px">${qrSvg(profileId, 2)}</div>`
        : '';
  const bg = c.design.backgroundImage ? `background-image:url('${escapeHtml(c.design.backgroundImage)}');background-size:cover;background-position:center;` : '';
  return `<div dir="ltr" style="position:relative;margin:24px auto;width:${c.layout.width}px;height:${c.layout.height}px;background-color:${escapeHtml(c.design.backgroundColor)};border:${c.design.borderWidth}px solid ${escapeHtml(c.design.borderColor)};border-radius:${c.design.borderRadius}px;overflow:hidden;${bg}">${fields}${qr}</div>`;
}

function basicHtml(d: DigitalIdCard, p: (key: string, o?: Record<string, unknown>) => string) {
  const name = `${d.profile?.first_name ?? ''} ${d.profile?.last_name ?? ''}`.trim();
  const photo = d.profile?.photo_url
    ? `<img src="${escapeHtml(d.profile.photo_url)}" style="width:80px;height:96px;object-fit:cover;border-radius:8px;background:${colors.white}"/>`
    : `<div style="width:80px;height:96px;border-radius:8px;background:${colors.white}"></div>`;
  return `<div style="width:340px;margin:24px auto;padding:24px;border-radius:12px;color:${colors.white};background:linear-gradient(135deg,${colors.brand},${colors.chart6})">
    <div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">${escapeHtml(d.school?.name ?? '')}</div><div style="font-size:11px;opacity:.8">${escapeHtml(p('identity'))}</div></div>
    <div style="display:flex;gap:16px">${photo}<div><div style="font-size:18px;font-weight:700">${escapeHtml(name)}</div><div style="font-size:13px;opacity:.9">${escapeHtml(p('id', { v: d.student_number }))}<br/>${escapeHtml(p('grade', { v: d.section?.grade_level?.name ?? d.grade_level }))}<br/>${escapeHtml(p('section', { v: d.section?.name ?? '—' }))}</div></div></div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${colors.overlayLightStrong};display:flex;justify-content:flex-end"><span class="qr" style="display:block;width:56px;height:56px;background:${colors.white};padding:4px;border-radius:4px">${qrSvg(d.profile?.id ?? d.id, 2)}</span></div></div>`;
}

/** Template weights ('bold', '600' …) → the matching IBM Plex Sans Arabic file (Android can't synthesize weights). */
function plexFamily(weight?: string | number | null) {
  const w = weight === 'bold' ? 700 : Number(weight) || 400;
  if (w >= 700) return 'IBMPlexSansArabic_700Bold';
  if (w >= 600) return 'IBMPlexSansArabic_600SemiBold';
  if (w >= 500) return 'IBMPlexSansArabic_500Medium';
  return 'IBMPlexSansArabic_400Regular';
}
