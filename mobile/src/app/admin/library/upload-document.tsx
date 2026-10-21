import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FileText, Save, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { DocumentFieldInput, isLibraryKey, useLibraryCategories } from '@/features/admin/library';
import { adminLibrary, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';
import { IconTile } from '@/components/app/layout';

const MAX_FILE = 50 * 1024 * 1024;
const size = (b?: number) => (!b ? '' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Upload a document with its category's custom fields (web: Upload Document dialog). */
export default function LibraryUploadDocument() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const cats = useLibraryCategories();
  const [categoryId, setCategoryId] = useState(category ?? '');
  const fields = useApi(categoryId ? ['admin', 'library-doc-fields', categoryId] : null, ([, , cid]) => adminLibrary.documentFields(cid as string));
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const defs = [...(fields.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const defsKey = defs.map((d) => d.id).join(',');
  // Reset the field values when the category's fields change (during render, not in an effect).
  const [valuesFor, setValuesFor] = useState<string | null>(null);
  if (defsKey !== valuesFor) {
    setValuesFor(defsKey);
    setValues(Object.fromEntries(defs.map((d) => [d.id, d.field_type === 'checkbox' ? false : d.field_type === 'select_multiple' ? [] : ''])));
  }

  async function choose() {
    const [f] = await pickDocuments({ multiple: false });
    if (!f) return;
    setFileError(null);
    if (f.size && f.size > MAX_FILE) {
      setFileError(t('app.lb_file_too_large_size', { size: size(f.size) }));
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!title.trim()) return;
    if (defs.some((d) => d.is_required && empty(values[d.id]))) return toast.error(t('app.lb_fill_required'));
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      if (file) {
        const up = await media.uploadLibraryFile({ uri: file.uri, name: file.name, type: file.type }, 'document', categoryId || undefined);
        if (!up.success || !up.data) return toast.error(up.error || t('app.lb_file_failed'));
        fileUrl = up.data.url;
      }
      // Stored as { field_id: { name, type, value } } like the web.
      const custom: Record<string, unknown> = {};
      for (const d of defs) if (!empty(values[d.id])) custom[d.id] = { name: d.field_name, type: d.field_type, value: values[d.id] };
      const r = await adminLibrary.createBook({
        title: title.trim(),
        author: author.trim() || 'Unknown',
        reference: reference.trim() || undefined,
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        document_type: 'document',
        file_url: fileUrl,
        custom_fields: custom,
      } as Record<string, unknown>);
      if (!r.success) return toast.error(r.error || t('app.lb_doc_failed'));
      toast.success(t('app.lb_doc_uploaded'));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {node}
    </View>
  );

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_upload_document') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{t('app.lb_upload_desc')}</Text>
        <Card>
          <CardContent className="gap-4 pt-4">
            {field(
              t('app.lb_category'),
              <Picker
                value={categoryId || 'NONE'}
                onChange={(x) => setCategoryId(x === 'NONE' ? '' : x)}
                options={[{ value: 'NONE', label: t('app.lb_no_category') }, ...[...(cats.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => ({ value: c.id, label: c.name }))]}
              />,
            )}
            {field(t('app.lb_title_req'), <Input value={title} onChangeText={setTitle} placeholder={t('app.lb_doc_title_ph')} />)}
            {field(t('app.lb_author'), <Input value={author} onChangeText={setAuthor} placeholder={t('app.lb_author_ph')} />)}
            {field(t('app.lb_reference'), <Input value={reference} onChangeText={setReference} placeholder="DOC-001" />)}
            {field(t('app.lb_description'), <Textarea value={description} onChangeText={setDescription} placeholder={t('app.lb_brief_description')} />)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-sm font-semibold">{t('app.lb_attach_file')}</Text>
            {file ? (
              <View className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3">
                <IconTile icon={FileText} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{file.name}</Text>
                  <Text className="text-muted-foreground text-xs">{size(file.size)}</Text>
                </View>
                <Pressable onPress={() => setFile(null)} hitSlop={8} accessibilityLabel={t('app.lb_remove')}>
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={choose} className="border-info-soft dark:border-border items-center gap-1 rounded-xl border border-dashed p-5">
                <Icon as={Upload} className="text-muted-foreground size-6" />
                <Text className="text-muted-foreground text-center text-xs">{t('app.lb_doc_drop')}</Text>
              </Pressable>
            )}
            {fileError ? <Text className="text-destructive text-sm">{fileError}</Text> : null}
          </CardContent>
        </Card>

        {categoryId ? (
          fields.isLoading ? (
            <LoadingList rows={2} />
          ) : defs.length ? (
            <Card>
              <CardContent className="gap-4 pt-4">
                <Text className="font-semibold">{t('app.lb_category_fields')}</Text>
                {defs.map((d) => (
                  <View key={d.id}>{field(`${d.field_name}${d.is_required ? ' *' : ''}`, <DocumentFieldInput field={d} value={values[d.id]} onChange={(v) => setValues((p) => ({ ...p, [d.id]: v }))} />)}</View>
                ))}
              </CardContent>
            </Card>
          ) : null
        ) : null}

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()} disabled={saving}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={submit} disabled={saving || !title.trim()}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? t('app.lb_uploading') : t('app.lb_upload_document')}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
