import type { MessageListItem, MessageView, ThreadMessage } from '@studently/api-client';
import { htmlToText } from '@studently/shared-utils';
import { type Href, router } from 'expo-router';
import { Archive, ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, FileText, Inbox, MailOpen, Paperclip, PenSquare, Reply, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { messaging } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const VIEWS: { key: MessageView; label: 'unread' | 'read' | 'archived' | 'sent' }[] = [
  { key: 'inbox', label: 'unread' },
  { key: 'read', label: 'read' },
  { key: 'archived', label: 'archived' },
  { key: 'sent', label: 'sent' },
];
const VIEW_ICONS = { inbox: Inbox, read: MailOpen, archived: Archive, sent: Send };

const initials = (name?: string | null) =>
  !name || name === 'Unknown'
    ? '?'
    : name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('');
const fileSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);

function Avatar({ name }: { name?: string | null }) {
  return (
    <View className="bg-primary size-10 items-center justify-center rounded-full">
      <Text className="text-primary-foreground text-sm font-semibold">{initials(name)}</Text>
    </View>
  );
}

/**
 * Messages by folder with search, sort, thread view, reply, archive and delete. Shared by every
 * role (web: components/messaging/MessagingInbox); `writeHref` is that role's compose screen.
 */
export function MessagingInboxScreen({ writeHref, openId }: { writeHref: Href; openId?: string }) {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`teacherPages.messaging.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<MessageView>('inbox');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput.trim(), 350);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [openMessage, setOpenMessage] = useState<string | null>(openId ?? null);
  const list = useApi(['messaging', 'list', view, search, order], ([, , v, s, o]) => messaging.listMessages(v as MessageView, { page: 1, limit: 50, search: String(s) || undefined, order: o as 'asc' | 'desc' }));
  const unread = useApi(['messaging', 'unread'], () => messaging.getUnreadCount(), { refreshInterval: 30_000 });
  const thread = useApi(openMessage ? ['messaging', 'thread', openMessage] : null, ([, , mid]) => messaging.getThread(String(mid)), {
    onSuccess: () => {
      list.mutate();
      unread.mutate();
    },
    onError: () => {
      toast.error(m('failedToLoadMessage'));
      setOpenMessage(null);
    },
  });

  const reply = (messageId: string, senderProfileId: string, senderName: string, subject: string) =>
    router.push({ pathname: writeHref as never, params: { reply_to: senderProfileId, reply_name: senderName, reply_to_message_id: messageId, subject: subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}` } });

  async function archive(id: string) {
    const r = await messaging.archiveMessage(id);
    if (!r.success) return toast.error(r.error || m('failedToArchiveMessage'));
    toast.success(m('messageArchived'));
    setOpenMessage(null);
    list.mutate();
  }

  async function remove(msg: ThreadMessage, all: ThreadMessage[]) {
    if (!(await confirm({ title: m('deleteThisMessage'), body: m('deleteMessageWarning'), confirmLabel: m('delete'), destructive: true }))) return;
    const r = await messaging.deleteMessage(msg.id);
    if (!r.success) return toast.error(r.error || m('notAllowedToDelete'));
    toast.success(m('messageDeleted'));
    const remaining = all.filter((x) => x.id !== msg.id);
    if (!remaining.length) {
      setOpenMessage(null);
      list.mutate();
    } else setOpenMessage(remaining[0].id);
  }

  const msgs = thread.data?.messages ?? null;
  if (openMessage && msgs) {
    const last = msgs[msgs.length - 1];
    const canReply = !msgs.every((x) => x.is_own);
    return (
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <View className="flex-row flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onPress={() => setOpenMessage(null)}>
            <Icon as={ArrowLeft} className="text-foreground size-4 rtl:rotate-180" />
            <Text>{m('back')}</Text>
          </Button>
          <View className="flex-1" />
          {canReply ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                const other = [...msgs].reverse().find((x) => !x.is_own) ?? last;
                reply(last.id, other.sender_profile_id, other.sender_name, last.subject);
              }}>
              <Icon as={Reply} className="text-foreground size-4" />
              <Text>{m('reply')}</Text>
            </Button>
          ) : null}
          {last.status !== 'sent' && last.status !== 'archived' ? (
            <Button size="sm" variant="outline" onPress={() => archive(last.id)}>
              <Icon as={Archive} className="text-foreground size-4" />
              <Text>{m('archive')}</Text>
            </Button>
          ) : null}
        </View>
        <Text className="text-lg font-semibold">{last.subject}</Text>
        <Card>
          {msgs.map((x, i) => (
            <View key={x.id}>
              {i > 0 ? <Separator /> : null}
              <View className="gap-3 p-4">
                <View className="flex-row items-start gap-3">
                  <Avatar name={x.sender_name} />
                  <View className="flex-1">
                    <Text className="text-sm">
                      <Text className="text-sm font-semibold">{x.sender_name}</Text>
                      {x.is_own ? <Text className="text-muted-foreground text-sm"> {m('you')}</Text> : null}
                    </Text>
                    <Text className="text-muted-foreground text-xs">{new Date(x.created_at).toLocaleString(i18n.language)}</Text>
                  </View>
                  {x.can_delete ? (
                    <Button size="icon" variant="ghost" onPress={() => remove(x, msgs)} accessibilityLabel={m('deleteMessage')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  ) : null}
                </View>
                <Text selectable className="text-sm leading-6">
                  {htmlToText(x.body)}
                </Text>
                {x.attachments.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {x.attachments.map((att) => (
                      <Pressable key={att.id} onPress={() => Linking.openURL(att.url)} className="border-border flex-row items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                        <Icon as={FileText} className="text-muted-foreground size-3.5" />
                        <Text className="max-w-44 text-xs" numberOfLines={1}>
                          {att.file_name}
                        </Text>
                        <Text className="text-muted-foreground text-xs">({fileSize(att.size)})</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    );
  }

  const items: MessageListItem[] = list.data ?? [];
  const count = unread.data?.count ?? 0;
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <FilterChips value={view} onChange={setView} options={VIEWS.map((v) => ({ value: v.key, label: v.key === 'inbox' && count > 0 ? `${m(v.label)} (${count > 99 ? '99+' : count})` : m(v.label) }))} />
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <SearchBar value={searchInput} onChangeText={setSearchInput} placeholder={m('searchMessagesPlaceholder')} />
        </View>
        <Button size="icon" variant="outline" onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))} accessibilityLabel={order === 'desc' ? m('newestFirst') : m('oldestFirst')}>
          <Icon as={order === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide} className="text-foreground size-4" />
        </Button>
        <Button size="sm" onPress={() => router.push(writeHref)}>
          <Icon as={PenSquare} className="text-primary-foreground size-4" />
          <Text>{m('write')}</Text>
        </Button>
      </View>
      <Text className="text-muted-foreground text-xs">{order === 'desc' ? m('newestFirst') : m('oldestFirst')}</Text>
      {list.isLoading && !list.data ? (
        <LoadingList />
      ) : !items.length ? (
        <EmptyState icon={VIEW_ICONS[view]} title={search ? m('noMessagesMatchSearch') : m('noMessages')} />
      ) : (
        <Card>
          {items.map((item, i) => {
            const isUnread = item.status === 'unread';
            return (
              <View key={item.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable onPress={() => setOpenMessage(item.messages.id)} className={cn('flex-row gap-3 px-4 py-3', isUnread && 'bg-primary/5')}>
                  <Avatar name={item.sender_name} />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text className={cn('flex-1 text-sm', isUnread && 'font-bold')} numberOfLines={1}>
                        {item.sender_name}
                      </Text>
                      <Text className="text-muted-foreground text-xs">{new Date(item.messages.created_at).toLocaleDateString(i18n.language)}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text className={cn('flex-1 text-sm', isUnread && 'font-semibold')} numberOfLines={1}>
                        {item.messages.subject}
                      </Text>
                      {item.has_attachments ? <Icon as={Paperclip} className="text-muted-foreground size-3" /> : null}
                    </View>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {item.messages.body.replace(/<[^>]+>/g, '').slice(0, 100)}
                    </Text>
                  </View>
                  {view !== 'sent' ? (
                    <Pressable onPress={() => reply(item.messages.id, item.messages.sender_profile_id, item.sender_name, item.messages.subject)} hitSlop={8} accessibilityLabel={m('reply')} className="self-center">
                      <Icon as={Reply} className="text-muted-foreground size-4" />
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}
