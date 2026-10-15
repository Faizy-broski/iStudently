import type { FeedbackCategory, FeedbackStatus, LoginQuote, QuoteRotation } from '@studently/api-client';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Bug, Lightbulb, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { Picker } from '@/components/app/picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FEEDBACK_VARIANT } from '@/features/superadmin/feedback';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';

type Section = 'feedback' | 'quotes';
type StatusFilter = 'all' | FeedbackStatus;
type CategoryFilter = 'all' | FeedbackCategory;

function Feedback() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'feedback', status, category], () =>
    platform.listFeedback({ status: status === 'all' ? undefined : status, category: category === 'all' ? undefined : category }),
  );
  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pb-2">
        <FilterChips<CategoryFilter>
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: t('app.ib_all_categories') },
            { value: 'bug', label: t('app.ib_cat_bug') },
            { value: 'feature_request', label: t('app.ib_cat_feature_request') },
          ]}
        />
        <FilterChips<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: t('app.ib_status_open') },
            { value: 'in_progress', label: t('app.ib_status_in_progress') },
            { value: 'resolved', label: t('app.ib_status_resolved') },
            { value: 'all', label: t('app.sa_filter_all') },
          ]}
        />
      </View>
      <DataList
        items={data}
        error={error}
        isLoading={isLoading}
        isRefreshing={isValidating && !isLoading}
        onRefresh={() => mutate()}
        emptyTitle={t('app.ib_no_feedback')}
        emptyBody={t('app.ib_no_feedback_body')}
        keyExtractor={(f) => f.id}
        renderItem={(f) => (
          <ListRow
            title={f.title}
            subtitle={[f.submitter_name ? t('app.ib_from', { name: f.submitter_name }) : null, formatDate(f.created_at)].filter(Boolean).join(' · ')}
            leading={<Icon as={f.category === 'bug' ? Bug : Lightbulb} className="text-muted-foreground size-5" />}
            trailing={
              <Badge variant={FEEDBACK_VARIANT[f.status]}>
                <Text>{t(`app.ib_status_${f.status}`)}</Text>
              </Badge>
            }
            onPress={() => router.push({ pathname: '/superadmin/inbox/feedback/[id]', params: { id: f.id } })}
          />
        )}
      />
    </View>
  );
}

function Quotes() {
  const { t, i18n } = useTranslation();
  const quotes = useApi(['platform', 'quotes'], () => platform.listQuotes());
  const settings = useApi(['platform', 'quote-settings'], () => platform.getQuoteSettings());
  const reorder = useAction(platform.reorderQuotes);
  const rotation = useAction(platform.setQuoteRotation, { success: t('app.saved'), onSuccess: () => settings.mutate() });

  const sorted = [...(quotes.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  async function move(q: LoginQuote, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === q.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    // Optimistic: show the new order immediately, then save.
    quotes.mutate(next.map((x, k) => ({ ...x, sort_order: k })), { revalidate: false });
    if (!(await reorder.run(next.map((x) => x.id))).ok) quotes.mutate();
  }

  return (
    <DataList
      items={quotes.data ? sorted : undefined}
      error={quotes.error}
      isLoading={quotes.isLoading}
      isRefreshing={quotes.isValidating && !quotes.isLoading}
      onRefresh={() => {
        quotes.mutate();
        settings.mutate();
      }}
      emptyTitle={t('app.ib_no_quotes')}
      keyExtractor={(q) => q.id}
      header={
        <View className="gap-1.5 px-4 pb-3">
          <Text className="text-muted-foreground text-sm">{t('app.ib_rotation')}</Text>
          <Picker
            value={settings.data?.rotation}
            onChange={(v) => rotation.run(v as QuoteRotation)}
            options={[
              { value: 'weekly', label: t('app.ib_rotation_weekly') },
              { value: 'monthly', label: t('app.ib_rotation_monthly') },
            ]}
          />
        </View>
      }
      renderItem={(q, i) => (
        <ListRow
          title={i18n.language === 'ar' ? q.text_ar : q.text_en}
          subtitle={i18n.language === 'ar' ? q.text_en : q.text_ar}
          trailing={
            <View className="flex-row items-center gap-3">
              {!q.is_active ? (
                <Badge variant="outline">
                  <Text>{t('app.ib_inactive')}</Text>
                </Badge>
              ) : null}
              <Pressable onPress={() => move(q, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={t('app.ib_move_up')}>
                <Icon as={ArrowUp} className={i === 0 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
              </Pressable>
              <Pressable onPress={() => move(q, 1)} disabled={i === sorted.length - 1} hitSlop={8} accessibilityLabel={t('app.ib_move_down')}>
                <Icon as={ArrowDown} className={i === sorted.length - 1 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
              </Pressable>
            </View>
          }
          chevron={false}
          onPress={() => router.push({ pathname: '/superadmin/inbox/quote-form', params: { id: q.id } })}
        />
      )}
    />
  );
}

export default function SuperadminInbox() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('feedback');
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center justify-between gap-3 px-4 pt-3 pb-3">
        <FilterChips<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'feedback', label: t('app.ib_feedback') },
            { value: 'quotes', label: t('app.ib_quotes') },
          ]}
        />
        {section === 'quotes' ? (
          <Button size="sm" onPress={() => router.push('/superadmin/inbox/quote-form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{t('app.ib_new_quote')}</Text>
          </Button>
        ) : null}
      </View>
      {section === 'feedback' ? <Feedback /> : <Quotes />}
    </View>
  );
}
