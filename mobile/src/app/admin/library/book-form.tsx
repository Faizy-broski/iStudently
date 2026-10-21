import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ExternalLink, FileText, ImageIcon, Save, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
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
import { DOCUMENT_TYPES, isLibraryKey, orderCategoriesForSelect, useLibraryCategories } from '@/features/admin/library';
import { adminLibrary, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, pickImage, type PickedDocument } from '@/lib/upload';
import { IconTile } from '@/components/app/layout';

const MAX_FILE = 50 * 1024 * 1024;

/** Add / edit a book: details, cover image, optional digital file for the E-Library (web: Add/Edit Book dialogs). */
export default function LibraryBookForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const book = useApi(id ? ['admin', 'library-book', id] : null, ([, , bid]) => adminLibrary.book(bid as string));
  const cats = useLibraryCategories();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reference, setReference] = useState('');
  const [docType, setDocType] = useState('book');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [existingFile, setExistingFile] = useState<string | null>(null);
  const [fileMode, setFileMode] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const b = book.data;
  const bookId = b ? b.id : null;
  // Fill the form once when the book arrives (adjusting state during render, not in an effect).
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (b && bookId !== loadedId) {
    setLoadedId(bookId);
    setTitle(b.title);
    setAuthor(b.author);
    setIsbn(b.isbn ?? '');
    setCategoryId(b.category_id ?? '');
    setReference(b.reference ?? '');
    setDocType(b.document_type || 'book');
    setPublisher(b.publisher ?? '');
    setYear(b.publication_year ? String(b.publication_year) : '');
    setDescription(b.description ?? '');
    setCover(b.cover_image_url);
    setExistingFile(b.file_url);
  }

  async function chooseCover() {
    const r = await pickImage({ maxDimension: 1200, keepTransparency: false });
    if (!r.ok) {
      if (r.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setCoverBusy(true);
    try {
      const up = await media.uploadLibraryFile(r.file, 'cover');
      if (!up.success || !up.data) return toast.error(up.error || t('app.lb_cover_failed'));
      setCover(up.data.url);
    } finally {
      setCoverBusy(false);
    }
  }

  async function chooseFile() {
    const [f] = await pickDocuments({ multiple: false });
    if (!f) return;
    if (f.size && f.size > MAX_FILE) return toast.error(t('app.lb_file_too_large'));
    setFile(f);
  }

  async function save() {
    if (!title.trim() || !author.trim()) return toast.error(t('app.lb_title_author_required'));
    setSaving(true);
    try {
      let url: string | null | undefined = existingFile;
      if (fileMode === 'url' && fileUrl.trim()) url = fileUrl.trim();
      else if (file) {
        setUploadingFile(true);
        const up = await media.uploadLibraryFile({ uri: file.uri, name: file.name, type: file.type }, 'document', categoryId || undefined);
        setUploadingFile(false);
        if (!up.success || !up.data) return toast.error(up.error || t('app.lb_file_failed'));
        url = up.data.url;
      }
      const body = {
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim() || null,
        category_id: categoryId || undefined,
        reference: reference.trim() || undefined,
        document_type: docType,
        publisher: publisher.trim() || undefined,
        publication_year: year ? parseInt(year, 10) || null : null,
        description: description.trim() || undefined,
        cover_image_url: cover ?? undefined,
        file_url: url ?? undefined,
      } as Record<string, unknown>;
      const r = bookId ? await adminLibrary.updateBook(bookId, body) : await adminLibrary.createBook(body);
      if (!r.success) return toast.error(r.error || (bookId ? t('app.lb_update_failed') : t('app.lb_add_failed')));
      toast.success(bookId ? t('app.lb_updated') : t('app.lb_added'));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
      setUploadingFile(false);
    }
  }

  if (id && book.isLoading) return <LoadingList />;
  const field = (label: string, node: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {node}
    </View>
  );

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: bookId ? t('app.lb_edit_book') : t('app.lb_add_book') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{bookId ? t('app.lb_edit_book_desc') : t('app.lb_add_book_desc')}</Text>
        <Card>
          <CardContent className="flex-row items-center gap-4 pt-4">
            <Pressable onPress={chooseCover} disabled={coverBusy} className="bg-muted border-info-soft dark:border-border h-28 w-20 items-center justify-center overflow-hidden rounded-xl border">
              {cover ? <Image source={{ uri: cover }} style={{ width: 80, height: 112 }} contentFit="cover" /> : <Icon as={ImageIcon} className="text-muted-foreground size-6" />}
            </Pressable>
            <View className="flex-1 gap-2">
              <Text className="text-sm font-semibold">{t('app.lb_cover')}</Text>
              <Text className="text-muted-foreground text-xs">{t('app.lb_cover_hint')}</Text>
              <View className="flex-row gap-2">
                <Button size="sm" variant="outline" disabled={coverBusy} onPress={chooseCover}>
                  <Text>{coverBusy ? t('app.lb_uploading') : cover ? t('app.lb_change') : t('app.lb_upload')}</Text>
                </Button>
                {cover ? (
                  <Button size="sm" variant="ghost" onPress={() => setCover(null)}>
                    <Icon as={X} className="text-foreground size-3.5" />
                    <Text>{t('app.lb_remove')}</Text>
                  </Button>
                ) : null}
              </View>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-4 pt-4">
            {field(t('app.lb_title_req'), <Input value={title} onChangeText={setTitle} placeholder={t('app.lb_title_ph')} />)}
            {field(t('app.lb_author_req'), <Input value={author} onChangeText={setAuthor} placeholder={t('app.lb_author_ph')} />)}
            {field('ISBN', <Input value={isbn} onChangeText={setIsbn} placeholder={t('app.lb_isbn_ph')} />)}
            {field(
              t('app.lb_category'),
              <Picker value={categoryId || 'NONE'} onChange={(x) => setCategoryId(x === 'NONE' ? '' : x)} options={[{ value: 'NONE', label: t('app.lb_no_category') }, ...orderCategoriesForSelect(cats.data ?? [])]} />,
            )}
            {field(t('app.lb_reference'), <Input value={reference} onChangeText={setReference} placeholder="LIB-001" />)}
            {field(t('app.lb_document_type'), <Picker value={docType} onChange={setDocType} options={DOCUMENT_TYPES.map((d) => ({ value: d, label: t(`app.lb_doc_${d}`) }))} />)}
            {field(t('app.lb_publisher'), <Input value={publisher} onChangeText={setPublisher} placeholder={t('app.lb_publisher_ph')} />)}
            {field(t('app.lb_year'), <Input value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} placeholder="2023" />)}
            {field(t('app.lb_description'), <Textarea value={description} onChangeText={setDescription} placeholder={t('app.lb_description_ph')} />)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-sm font-semibold">
              {t('app.lb_digital_file')} <Text className="text-muted-foreground text-xs">{t('app.lb_digital_file_hint')}</Text>
            </Text>
            <FilterChips
              value={fileMode}
              onChange={setFileMode}
              options={[
                { value: 'upload', label: t('app.lb_upload_file') },
                { value: 'url', label: t('app.lb_paste_url') },
              ]}
            />
            {fileMode === 'url' ? (
              <Input value={fileUrl} onChangeText={setFileUrl} autoCapitalize="none" keyboardType="url" placeholder="https://example.com/book.pdf" />
            ) : file ? (
              <View className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3">
                <IconTile icon={FileText} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{file.name}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {file.size ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ''}
                    {existingFile ? ` · ${t('app.lb_will_replace')}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => setFile(null)} hitSlop={8}>
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            ) : existingFile ? (
              <View className="border-info-soft dark:border-border gap-2 rounded-xl border p-3">
                <View className="flex-row items-center gap-2">
                  <IconTile icon={FileText} size={32} />
                  <Text className="flex-1 text-sm font-medium">{t('app.lb_file_uploaded')}</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onPress={() => openBrowserAsync(existingFile)}>
                    <Icon as={ExternalLink} className="text-foreground size-3.5" />
                    <Text>{t('app.lb_view_file')}</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={chooseFile}>
                    <Text>{t('app.lb_replace')}</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={() => setFileMode('url')}>
                    <Text>{t('app.lb_use_url')}</Text>
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setExistingFile(null)} accessibilityLabel={t('app.lb_remove')}>
                    <Icon as={X} className="text-foreground size-3.5" />
                  </Button>
                </View>
              </View>
            ) : (
              <Pressable onPress={chooseFile} className="border-info-soft dark:border-border items-center gap-1 rounded-xl border border-dashed p-5">
                <Icon as={Upload} className="text-muted-foreground size-6" />
                <Text className="text-muted-foreground text-center text-xs">{t('app.lb_file_drop')}</Text>
              </Pressable>
            )}
          </CardContent>
        </Card>

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()} disabled={saving}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving || coverBusy}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{uploadingFile ? t('app.lb_uploading_file') : saving ? t('app.lb_saving') : bookId ? t('app.lb_update_book') : t('app.lb_add_book')}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
