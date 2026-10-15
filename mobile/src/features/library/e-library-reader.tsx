import { openBrowserAsync } from 'expo-web-browser';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Bookmark, BookOpen, Download, Plus, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, View } from 'react-native';

import { EmptyState, LoadingList } from '@/components/app/states';
import { PublicWebView } from '@/components/app/web-session-view';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { sharePublicFile } from '@/lib/share-file';

/**
 * A digital book: open it in the system viewer, keep the reading position and bookmarks
 * (same server-side reader state as the web's flipbook). Admins may download it, like the web.
 */
export function ELibraryReader() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { me } = useSession();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const books = useApi(['admin', 'library-elibrary'], () => adminLibrary.eLibrary());
  const progress = useApi(bookId ? ['admin', 'library-progress', bookId] : null, ([, , id]) => adminLibrary.progress(id as string));
  const marks = useApi(bookId ? ['admin', 'library-bookmarks', bookId] : null, ([, , id]) => adminLibrary.bookmarks(id as string));
  const [page, setPage] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  const book = (books.data ?? []).find((b) => b.id === bookId);
  const role = me.status === 'ready' ? me.me.profile.role : null;
  const canDownload = role === 'admin' || role === 'super_admin';

  if (books.isLoading) return <LoadingList />;
  if (!book?.file_url) return <EmptyState icon={AlertCircle} title={t('app.lb_book_missing')} />;
  const fileUrl = book.file_url;

  const p = progress.data;
  const pageNo = () => {
    const n = parseInt(page, 10);
    return Number.isFinite(n) && n > 0 ? n - 1 : null;
  };

  async function savePosition() {
    const idx = pageNo();
    if (idx == null || !bookId) return toast.error(t('app.lb_page_invalid'));
    setBusy(true);
    try {
      const r = await adminLibrary.saveProgress(bookId, { lastPageIndex: idx, totalPages: p?.totalPages ?? undefined });
      if (!r.success) return toast.error(r.error || t('app.error_title'));
      toast.success(t('app.lb_position_saved'));
      progress.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function addMark() {
    const idx = pageNo();
    if (idx == null || !bookId) return toast.error(t('app.lb_page_invalid'));
    setBusy(true);
    try {
      const r = await adminLibrary.addBookmark(bookId, { pageIndex: idx, label: label.trim() || undefined });
      if (!r.success) return toast.error(r.error || t('app.error_title'));
      setLabel('');
      marks.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function removeMark(id: string) {
    const r = await adminLibrary.deleteBookmark(id);
    if (!r.success) return toast.error(r.error || t('app.error_title'));
    marks.mutate();
  }

  async function download() {
    try {
      const ext = fileUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'pdf';
      const name = `${(book?.title ?? 'book').replace(/[^\w\- ]+/g, '').trim() || 'book'}.${ext}`;
      await sharePublicFile(fileUrl, name, ext === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    } catch {
      toast.error(t('app.error_title'));
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: book.title ?? '' }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-lg font-semibold">{book.title}</Text>
            {book.author ? <Text className="text-muted-foreground">{book.author}</Text> : null}
            {p ? (
              <Text className="text-sm">
                {t('app.lb_last_page', { page: p.lastPageIndex + 1, total: p.totalPages ?? '?' })} · {new Date(p.updatedAt).toLocaleDateString(i18n.language)}
              </Text>
            ) : null}
            {/* iOS WebViews render PDFs; Android's don't, so it opens the system viewer there. */}
            {Platform.OS === 'ios' ? (
              <Button onPress={() => setReading(true)}>
                <Icon as={BookOpen} className="text-primary-foreground size-4" />
                <Text>{t('app.lb_read_in_app')}</Text>
              </Button>
            ) : null}
            <Button variant={Platform.OS === 'ios' ? 'outline' : 'default'} onPress={() => openBrowserAsync(fileUrl)}>
              <Icon as={BookOpen} className={Platform.OS === 'ios' ? 'text-foreground size-4' : 'text-primary-foreground size-4'} />
              <Text>{t('app.lb_open_book')}</Text>
            </Button>
            {canDownload ? (
              <Button variant="outline" onPress={download}>
                <Icon as={Download} className="text-foreground size-4" />
                <Text>{t('app.lb_download')}</Text>
              </Button>
            ) : null}
            <Text className="text-muted-foreground text-xs">{t('app.lb_reader_note')}</Text>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{t('app.lb_reading_position')}</Text>
            <View className="flex-row items-end gap-2">
              <View className="w-28 gap-1.5">
                <Label>{t('app.lb_page')}</Label>
                <Input value={page} onChangeText={setPage} keyboardType="number-pad" placeholder={p ? String(p.lastPageIndex + 1) : '1'} />
              </View>
              <Button variant="outline" onPress={savePosition} disabled={busy}>
                <Text>{t('app.lb_save_position')}</Text>
              </Button>
            </View>
            <Separator />
            <View className="flex-row items-center gap-2">
              <Icon as={Bookmark} className="text-foreground size-4" />
              <Text className="font-semibold">{t('app.lb_bookmarks')}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Input className="flex-1" value={label} onChangeText={setLabel} placeholder={t('app.lb_bookmark_label')} />
              <Button variant="outline" onPress={addMark} disabled={busy} accessibilityLabel={t('app.lb_add_bookmark')}>
                <Icon as={Plus} className="text-foreground size-4" />
                <Text>{t('app.lb_add_bookmark')}</Text>
              </Button>
            </View>
            {(marks.data ?? []).length === 0 ? (
              <Text className="text-muted-foreground text-sm">{t('app.lb_no_bookmarks')}</Text>
            ) : (
              [...(marks.data ?? [])]
                .sort((a, b) => a.pageIndex - b.pageIndex)
                .map((m) => (
                  <View key={m.id} className="flex-row items-center gap-2">
                    <Text className="flex-1 text-sm">
                      {t('app.lb_page')} {m.pageIndex + 1}
                      {m.label ? ` · ${m.label}` : ''}
                    </Text>
                    <Button size="icon" variant="ghost" onPress={() => removeMark(m.id)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
      <Modal visible={reading} animationType="slide" onRequestClose={() => setReading(false)}>
        <SafeAreaView className="bg-background flex-1">
          <View className="border-border flex-row items-center gap-2 border-b px-3 py-2">
            <Text className="flex-1 font-semibold" numberOfLines={1}>
              {book.title}
            </Text>
            <Button size="icon" variant="ghost" onPress={() => setReading(false)} accessibilityLabel={t('common.close')}>
              <Icon as={X} className="text-foreground size-5" />
            </Button>
          </View>
          <PublicWebView url={fileUrl} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
