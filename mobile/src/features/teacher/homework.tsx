import type { HomeworkAttachment } from '@studently/api-client';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Paperclip, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

export const attachmentUrl = (a: HomeworkAttachment) => (typeof a === 'string' ? a : a.url);
export const attachmentName = (a: HomeworkAttachment, i: number) => (typeof a === 'string' ? decodeURIComponent(a.split('/').pop()?.split('?')[0] ?? `#${i + 1}`) : a.name || decodeURIComponent(a.url.split('/').pop() ?? `#${i + 1}`));

const MAX = 10 * 1024 * 1024;

/** Days until the due date and its colour (web: getDaysUntilDue / getDueDateColor). */
export function dueInfo(due: string) {
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  const tone = days < 0 ? 'text-destructive' : days <= 2 ? 'text-warning' : days <= 7 ? 'text-warning' : 'text-success';
  return { days, tone };
}

/** Existing attachments (open) and newly picked files (remove), with a pick button; files go through the API upload. */
export function AttachmentField({ existing, picked, onPick, onRemove, onRemoveExisting, readOnly, maxBytes = MAX, onTooLarge }: { readOnly?: boolean; maxBytes?: number; onTooLarge?: (name: string) => void; existing?: HomeworkAttachment[]; picked: PickedDocument[]; onPick: (d: PickedDocument[]) => void; onRemove: (i: number) => void; onRemoveExisting?: (i: number) => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.assignments.${key}`, o);
  async function choose() {
    const docs = await pickDocuments({ multiple: true });
    for (const d of docs) if ((d.size ?? 0) > maxBytes) onTooLarge?.(d.name);
    onPick(docs.filter((d) => (d.size ?? 0) <= maxBytes));
  }
  return (
    <View className="gap-2">
      {(existing ?? []).map((a, i) => (
        <View key={`e${i}`} className="bg-info-soft flex-row items-center gap-2 rounded-xl px-3 py-2">
          <Icon as={FileText} className="text-brand dark:text-brand-secondary size-4" />
          <Pressable onPress={() => WebBrowser.openBrowserAsync(attachmentUrl(a))} accessibilityRole="link" className="flex-1 active:opacity-70">
            <Text className="text-brand dark:text-brand-secondary text-sm font-medium" numberOfLines={1}>
              {attachmentName(a, i)}
            </Text>
          </Pressable>
          {onRemoveExisting ? (
            <Pressable onPress={() => onRemoveExisting(i)} hitSlop={8} accessibilityLabel={t('common.delete')} className="bg-destructive-soft size-7 items-center justify-center rounded-full active:opacity-70">
              <Icon as={X} className="text-destructive size-3.5" />
            </Pressable>
          ) : null}
        </View>
      ))}
      {picked.map((f, i) => (
        <View key={`p${i}`} className="bg-muted/40 flex-row items-center gap-2 rounded-xl px-3 py-2">
          <Icon as={Paperclip} className="text-muted-foreground size-4" />
          <Text className="flex-1 text-sm" numberOfLines={1}>
            {f.name}
          </Text>
          <Pressable onPress={() => onRemove(i)} hitSlop={8} accessibilityLabel={t('common.delete')} className="bg-destructive-soft size-7 items-center justify-center rounded-full active:opacity-70">
            <Icon as={X} className="text-destructive size-3.5" />
          </Pressable>
        </View>
      ))}
      {readOnly ? null : (
        <>
          <Button variant="outline" size="sm" className="self-start" onPress={choose}>
            <Icon as={Paperclip} className="size-4" />
            <Text>{k('clickToUpload')}</Text>
          </Button>
          <Text className="text-muted-foreground text-xs">{k('fileTypesHint')}</Text>
        </>
      )}
    </View>
  );
}
