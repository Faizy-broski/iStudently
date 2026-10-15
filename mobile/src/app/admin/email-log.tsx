import type { EmailLogEntry } from '@studently/api-client';
import { htmlToText } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField } from '@/components/app/date-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMail } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

/** Emails sent from the school, newest first; tap to read (web: /admin/email/log). */
export default function EmailLog() {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const [open, setOpen] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [range, setRange] = useState({ start: '', end: '' });
  const list = usePagedApi<EmailLogEntry>(`admin-email-log:${campusId ?? 'school'}:${range.start}:${range.end}`, (page) =>
    adminMail.log(campusId, { page, start_date: range.start || undefined, end_date: range.end || undefined }),
  );

  return (
    <>
      <Stack.Screen options={{ title: t('app.el_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-2 px-4 pt-3 pb-1">
              <View className="flex-row items-end gap-2">
                <DateField className="flex-1" value={start} onChange={setStart} clearable max={end || undefined} />
                <DateField className="flex-1" value={end} onChange={setEnd} clearable min={start || undefined} />
              </View>
              <Button size="sm" onPress={() => setRange({ start, end })}>
                <Text>{t('email.go', { defaultValue: t('common.go') })}</Text>
              </Button>
            </View>
          }
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={t('app.el_none')}
          keyExtractor={(e) => e.id}
          renderItem={(e) => (
            <Pressable onPress={() => setOpen(open === e.id ? null : e.id)} className="gap-1 px-4 py-3" accessibilityRole="button">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 font-medium" numberOfLines={1}>
                  {e.subject}
                </Text>
                {e.is_test ? (
                  <Badge variant="outline">
                    <Text>{t('app.el_test')}</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="text-muted-foreground text-xs">
                {[
                  formatDateTime(e.created_at),
                  t(e.recipient_type === 'staff' ? 'app.role_staff' : 'app.role_student'),
                  t('app.el_counts', { sent: e.success_count, failed: e.fail_count, total: e.total_recipients }),
                  e.sent_by ? `${e.sent_by.first_name} ${e.sent_by.last_name}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {open === e.id ? (
                <View className="gap-1.5 pt-2">
                  {e.to_addresses ? (
                    <Text selectable className="text-xs">
                      <Text className="text-muted-foreground text-xs">{t('email.detail_sent_to')}: </Text>
                      {e.to_addresses}
                    </Text>
                  ) : null}
                  {e.cc ? (
                    <Text selectable className="text-xs">
                      <Text className="text-muted-foreground text-xs">{t('email.detail_cc')}: </Text>
                      {e.cc}
                    </Text>
                  ) : null}
                  {e.is_test && e.test_email ? <Text className="text-xs">{`${t('email.detail_test_mode')}: ${e.test_email}`}</Text> : null}
                  <Text className="text-muted-foreground text-xs">{t('email.detail_message')}</Text>
                  <Text selectable className="text-sm">
                    {htmlToText(e.body)}
                  </Text>
                  {e.errors?.length ? (
                    <View className="gap-0.5 rounded-md bg-red-50 p-2 dark:bg-red-950/40">
                      <Text className="text-xs font-semibold text-red-700">{t('email.detail_failed_deliveries')}</Text>
                      {e.errors.map((x, i) => (
                        <Text key={i} className="text-xs text-red-700">{`${x.name} <${x.email}>: ${x.error}`}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </>
  );
}
