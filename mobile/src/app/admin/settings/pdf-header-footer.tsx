import type { PdfHeaderFooter } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Check, Eye, FileImage, ImagePlus, Link2, Plus, Save } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { CheckRow } from '@/features/admin/attendance';
import { RichOrSourceField } from '@/components/app/rich-text-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { adminSchool, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, printHtml } from '@/lib/print';
import { pickImage } from '@/lib/upload';

const TOKENS = ['school_logo', 'school_name', 'school_address', 'school_phone', 'school_email', 'date', 'page_number', 'total_pages'] as const;

const DEFAULT: PdfHeaderFooter = { pdf_header_html: '', pdf_footer_html: '', pdf_margin_top: 20, pdf_margin_bottom: 18, pdf_exclude_print: false };

/** Token picker + insert at the editor's cursor (web: SubstitutionsPanel). */
function Substitutions({ onInsert, logoUrl }: { onInsert: (token: string) => void; logoUrl?: string | null }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(TOKENS[0]);
  const [done, setDone] = useState(false);
  const token = `{${selected}}`;
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground text-xs">{t('app.pdf_substitutions')}</Text>
      <View className="flex-row items-center gap-2">
        <Picker className="flex-1" value={selected} onChange={setSelected} options={TOKENS.map((k) => ({ value: k, label: t(`app.pdf_sub_${k}`) }))} />
        <Button
          size="sm"
          variant="outline"
          onPress={() => {
            onInsert(token);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          <Icon as={done ? Check : Plus} className="text-foreground size-3.5" />
          <Text>{done ? t('app.pdf_inserted') : t('app.pdf_insert')}</Text>
        </Button>
      </View>
      {selected === 'school_logo' && logoUrl ? (
        <Image source={{ uri: logoUrl }} contentFit="contain" style={{ height: 32, width: 96 }} className="border-border bg-muted/40 rounded border" />
      ) : (
        <Text className="bg-muted border-border self-start rounded border px-2 py-1 font-mono text-xs">{token}</Text>
      )}
    </View>
  );
}

/** Insert an image (uploaded through the API or a URL, with description and size) or a link (web: Image/Link dialogs). */
function InsertMedia({ onInsert }: { onInsert: (html: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [kind, setKind] = useState<'image' | 'link' | null>(null);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [ratio, setRatio] = useState<number | null>(null);
  const [keep, setKeep] = useState(true);
  const [href, setHref] = useState('');
  const [label, setLabel] = useState('');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('none');
  const [uploading, setUploading] = useState(false);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const close = () => {
    setKind(null);
    setSrc('');
    setAlt('');
    setWidth('');
    setHeight('');
    setRatio(null);
    setHref('');
    setLabel('');
    setTitle('');
    setTarget('none');
  };

  async function upload() {
    const picked = await pickImage({ maxDimension: 1200 });
    if (!picked.ok) return;
    setUploading(true);
    const r = await media.uploadImage(picked.file);
    setUploading(false);
    if (!r.success || !r.data) return toast.error(r.error || t('app.error_title'));
    setSrc(r.data.url);
    RNImage.getSize(r.data.url, (w, h) => {
      setRatio(w / h);
      if (!width && !height) {
        setWidth(String(w));
        setHeight(String(h));
      }
    });
  }
  const setW = (v: string) => {
    const n = v.replace(/\D/g, '');
    setWidth(n);
    if (keep && ratio && n) setHeight(String(Math.round(Number(n) / ratio)));
  };
  const setH = (v: string) => {
    const n = v.replace(/\D/g, '');
    setHeight(n);
    if (keep && ratio && n) setWidth(String(Math.round(Number(n) * ratio)));
  };

  function insert() {
    if (kind === 'image') {
      if (!src.trim()) return;
      const size = `${width ? ` width="${esc(width)}"` : ''}${height ? ` height="${esc(height)}"` : ''}`;
      onInsert(`<img src="${esc(src.trim())}" alt="${esc(alt)}"${size} />`);
    } else {
      if (!href.trim()) return;
      const attrs = `${title ? ` title="${esc(title)}"` : ''}${target !== 'none' ? ` target="${target}"` : ''}`;
      onInsert(`<a href="${esc(href.trim())}"${attrs}>${esc(label.trim() || href.trim())}</a>`);
    }
    close();
  }

  return (
    <View className="flex-row gap-2">
      <Button size="sm" variant="outline" onPress={() => setKind('image')}>
        <Icon as={ImagePlus} className="text-foreground size-3.5" />
        <Text>{t('app.pdf_ins_image')}</Text>
      </Button>
      <Button size="sm" variant="outline" onPress={() => setKind('link')}>
        <Icon as={Link2} className="text-foreground size-3.5" />
        <Text>{t('app.pdf_ins_link')}</Text>
      </Button>
      <Dialog open={!!kind} onOpenChange={(o) => !o && close()}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{kind === 'image' ? t('app.pdf_ins_image') : t('app.pdf_ins_link')}</DialogTitle>
          </DialogHeader>
          {kind === 'image' ? (
            <View className="gap-2">
              <Label>{t('app.pdf_img_source')}</Label>
              <Input value={src} onChangeText={setSrc} placeholder="https://" autoCapitalize="none" keyboardType="url" />
              <Button size="sm" variant="outline" onPress={upload} disabled={uploading}>
                <Text>{uploading ? t('common.loading') : t('app.pdf_img_choose')}</Text>
              </Button>
              <Label>{t('app.pdf_img_alt')}</Label>
              <Input value={alt} onChangeText={setAlt} />
              <Label>{t('app.pdf_img_dims')}</Label>
              <View className="flex-row items-center gap-2">
                <Input className="flex-1" value={width} onChangeText={setW} keyboardType="number-pad" placeholder={t('app.pdf_img_width')} />
                <Text>×</Text>
                <Input className="flex-1" value={height} onChangeText={setH} keyboardType="number-pad" placeholder={t('app.pdf_img_height')} />
              </View>
              <CheckRow checked={keep} onPress={() => setKeep((k) => !k)} label={t('app.pdf_img_constrain')} />
            </View>
          ) : (
            <View className="gap-2">
              <Label>{t('app.pdf_link_url')}</Label>
              <Input value={href} onChangeText={setHref} placeholder="https://" autoCapitalize="none" keyboardType="url" />
              <Label>{t('app.pdf_link_text')}</Label>
              <Input value={label} onChangeText={setLabel} />
              <Label>{t('app.pdf_link_title')}</Label>
              <Input value={title} onChangeText={setTitle} />
              <Label>{t('app.pdf_link_target')}</Label>
              <Picker value={target} onChange={setTarget} options={['none', '_blank', '_self', '_parent', '_top'].map((v) => ({ value: v, label: t(`app.pdf_target_${v.replace('_', '')}`) }))} />
            </View>
          )}
          <DialogFooter>
            <Button variant="outline" onPress={close}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button onPress={insert} disabled={kind === 'image' ? !src.trim() : !href.trim()}>
              <Text>{t('app.pdf_insert')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

/** Custom header/footer for printed PDFs of the school or the selected campus (web: /admin/settings/pdf-header-footer). */
export default function PdfHeaderFooterSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId, campus } = useCampus();
  const print = usePrintContext();
  const res = useApi(['admin', 'pdf-layout', campusId ?? 'school'], () => adminSchool.getPdfHeaderFooter(campusId));
  const [form, setForm] = useState<PdfHeaderFooter>(DEFAULT);
  const [top, setTop] = useState('20');
  const [bottom, setBottom] = useState('18');
  const [loadedKey, setLoadedKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const insertHeader = useRef<(token: string) => void>(() => {});
  const insertFooter = useRef<(token: string) => void>(() => {});
  const insertHeaderHtml = useRef<(html: string) => void>(() => {});
  const insertFooterHtml = useRef<(html: string) => void>(() => {});

  useEffect(() => {
    if (res.isLoading) return;
    const d = { ...DEFAULT, ...(res.data ?? {}) };
    setForm(d);
    setTop(String(d.pdf_margin_top ?? 20));
    setBottom(String(d.pdf_margin_bottom ?? 18));
    setLoadedKey((k) => k + 1); // remount the editors with the loaded HTML
  }, [res.data, res.isLoading]);

  // Web limits: 0–80 mm (an empty or invalid value falls back to the default).
  const margin = (v: string, d: number) => Math.min(80, Math.max(0, parseInt(v, 10) || d));
  const payload = (): PdfHeaderFooter => ({ ...form, pdf_margin_top: margin(top, 20), pdf_margin_bottom: margin(bottom, 18) });

  async function save() {
    setSaving(true);
    try {
      const r = await adminSchool.savePdfHeaderFooter(payload(), campusId);
      if (!r.success) return toast.error(r.error || t('app.pdf_save_failed'));
      toast.success(t('app.pdf_saved'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    try {
      await printHtml(buildPrintHtml({ title: t('app.pdf_title'), pages: [`<p>${t('app.pdf_preview_body')}</p>`], school: print.school, layout: payload(), withHeader: true }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  if (res.isLoading) return <LoadingList />;
  const logoUrl = campus?.logo_url ?? print.school.logo_url;

  const saveBtn = (
    <Button onPress={save} disabled={saving}>
      <Icon as={Save} className="text-primary-foreground size-4" />
      <Text className="">{saving ? t('app.pdf_saving') : t('common.save')}</Text>
    </Button>
  );

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.pdf_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <Icon as={FileImage} className="text-foreground size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{t('app.pdf_hint')}</Text>
        </View>
        <Card>
          <CardContent className="gap-4 pt-4">
            <Text className="text-muted-foreground text-sm font-medium">{t('app.pdf_header')}</Text>
            <RichOrSourceField key={`h-${loadedKey}`} campusId={campusId ?? undefined} value={form.pdf_header_html} onChange={(v) => setForm((f) => ({ ...f, pdf_header_html: v }))} insertRef={(fn) => (insertHeader.current = fn)} insertHtmlRef={(fn) => (insertHeaderHtml.current = fn)} />
            <InsertMedia onInsert={(html) => insertHeaderHtml.current(html)} />
            <Substitutions onInsert={(tok) => insertHeader.current(tok)} logoUrl={logoUrl} />
            <View className="gap-1.5">
              <Label className="text-muted-foreground">{t('app.pdf_margin_top')}</Label>
              <Input value={top} onChangeText={setTop} keyboardType="number-pad" className="w-28" maxLength={2} />
            </View>
            <Separator />
            <Text className="text-muted-foreground text-sm font-medium">{t('app.pdf_footer')}</Text>
            <RichOrSourceField key={`f-${loadedKey}`} campusId={campusId ?? undefined} value={form.pdf_footer_html} onChange={(v) => setForm((f) => ({ ...f, pdf_footer_html: v }))} insertRef={(fn) => (insertFooter.current = fn)} insertHtmlRef={(fn) => (insertFooterHtml.current = fn)} />
            <InsertMedia onInsert={(html) => insertFooterHtml.current(html)} />
            <Substitutions onInsert={(tok) => insertFooter.current(tok)} logoUrl={logoUrl} />
            <View className="gap-1.5">
              <Label className="text-muted-foreground">{t('app.pdf_margin_bottom')}</Label>
              <Input value={bottom} onChangeText={setBottom} keyboardType="number-pad" className="w-28" maxLength={2} />
            </View>
            <Separator />
            <CheckRow checked={form.pdf_exclude_print} onPress={() => setForm((f) => ({ ...f, pdf_exclude_print: !f.pdf_exclude_print }))} label={t('app.pdf_exclude_print')} />
          </CardContent>
        </Card>
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={preview}>
            <Icon as={Eye} className="text-foreground size-4" />
            <Text>{t('app.pdf_preview')}</Text>
          </Button>
          <View className="flex-1">{saveBtn}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
