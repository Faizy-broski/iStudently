import type { PendingSignup, PendingStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, Mail, Phone, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { StatTile, StatTiles } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Picker } from '@/components/app/picker';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminSignups } from '@/lib/api';
import { useApi, usePagedApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useDebounced } from '@/lib/use-debounced';

/** Accounts created from signup links, waiting for an admin (web: /admin/pending-approvals). */
export default function PendingApprovals() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`pendingApprovals.${k}`, o);
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const [status, setStatus] = useState<PendingStatus | 'all'>('pending');
  const [role, setRole] = useState('all');
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<PendingSignup | null>(null);
  const [reason, setReason] = useState('');
  const q = useDebounced(search.trim());
  const filters = { role: role === 'all' ? undefined : role, grade_level: grade === 'all' ? undefined : grade, search: q || undefined };
  const list = usePagedApi<PendingSignup>(`admin-pending:${campusId ?? 'school'}:${status}:${role}:${grade}:${q}`, (page) =>
    adminSignups.pending(campusId, { ...filters, status: status === 'all' ? undefined : status, page, limit: 30 }),
  );
  const counts = useApi(`admin-pending-counts:${campusId ?? 'school'}:${role}:${grade}:${q}`, () => adminSignups.statusCounts(campusId, filters));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const tab = (key: PendingStatus | 'all', label: string) => {
    const n = counts.data?.[key] ?? 0;
    return { value: key, label: n > 0 ? `${label} (${n})` : label };
  };
  const refresh = () => {
    list.mutate();
    counts.mutate();
    mutate((key) => typeof key === 'string' && key.startsWith('admin-pending'));
  };
  const nameOf = (s: PendingSignup) => `${s.first_name} ${s.last_name}`.trim();
  const approve = useAction((s: PendingSignup) => adminSignups.approve(s.id), { onSuccess: refresh });
  const reject = useAction((s: PendingSignup) => adminSignups.reject(s.id, reason.trim()), { onSuccess: refresh });

  function extra(s: PendingSignup) {
    const labels = new Map((s.link_meta?.custom_fields ?? []).map((f) => [f.id, (locale === 'ar' && f.label_ar) || f.label]));
    return Object.entries(s.extra_data ?? {})
      .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .map(([k, v]) => `${labels.get(k) ?? k.replace(/_/g, ' ')}: ${String(v)}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: p('pageTitle') }} />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-3 pb-2">
          {counts.data ? (
            <StatTiles>
              <StatTile label={p('tabPending')} value={String(counts.data.pending)} tone="warning" onPress={() => setStatus('pending')} />
              <StatTile label={p('tabApproved')} value={String(counts.data.approved)} tone="success" onPress={() => setStatus('approved')} />
              <StatTile label={p('tabRejected')} value={String(counts.data.rejected)} tone="destructive" onPress={() => setStatus('rejected')} />
            </StatTiles>
          ) : null}
          <SearchBar value={search} onChangeText={setSearch} placeholder={p('searchPlaceholder')} />
          <FilterChips<PendingStatus | 'all'>
            value={status}
            onChange={setStatus}
            options={[tab('all', p('tabAll')), tab('pending', p('tabPending')), tab('approved', p('tabApproved')), tab('rejected', p('tabRejected'))]}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Picker
                value={role}
                onChange={setRole}
                options={[
                  { value: 'all', label: p('filterRole') },
                  ...['teacher', 'student', 'parent', 'staff', 'librarian'].map((r) => ({ value: r, label: t(`app.role_${r}`, { defaultValue: r }) })),
                ]}
              />
            </View>
            <View className="flex-1">
              <Picker
                value={grade}
                onChange={setGrade}
                options={[{ value: 'all', label: t('app.pa_all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.name, label: g.name }))]}
              />
            </View>
          </View>
        </View>
        <DataList
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={p('emptyTitle')}
          emptyBody={status === 'pending' ? p('emptyDesc') : undefined}
          keyExtractor={(s) => s.id}
          contentContainerClassName="flex-grow gap-3 p-4"
          ItemSeparatorComponent={null}
          keyboardShouldPersistTaps="handled"
          renderItem={(s) => {
            const name = nameOf(s);
            const role = t(`app.role_${s.role}`, { defaultValue: s.role });
            return (
              <Card className="gap-2 py-3">
                <CardContent className="gap-2 px-4">
                  <View className="flex-row items-center gap-3">
                    <PersonAvatar name={name} />
                    <View className="flex-1">
                      <Text className="font-semibold">{name}</Text>
                      <Text className="text-muted-foreground text-xs">{[role, s.campus_name, formatDate(s.created_at)].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {s.status !== 'pending' || status === 'all' ? (
                      <StatusChip
                        label={p(s.status === 'approved' ? 'statusApproved' : s.status === 'pending' ? 'statusPending' : 'statusRejected')}
                        tone={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}
                        className="px-2 py-0.5"
                      />
                    ) : null}
                  </View>
                  <View className="gap-1">
                    <View className="flex-row items-center gap-2">
                      <Icon as={Mail} className="text-muted-foreground size-4" />
                      <Text className="text-sm" selectable>
                        {s.email}
                      </Text>
                    </View>
                    {s.phone ? (
                      <View className="flex-row items-center gap-2">
                        <Icon as={Phone} className="text-muted-foreground size-4" />
                        <Text className="text-sm" selectable>
                          {s.phone}
                        </Text>
                      </View>
                    ) : null}
                    {s.link_label ? <Text className="text-muted-foreground text-xs">{p('viaLink', { label: s.link_label })}</Text> : null}
                    {extra(s).map((line) => (
                      <Text key={line} className="text-muted-foreground text-xs">
                        {line}
                      </Text>
                    ))}
                    {s.rejection_reason ? <Text className="text-destructive text-xs">{s.rejection_reason}</Text> : null}
                    {s.status !== 'pending' && s.reviewer_name ? (
                      <Text className="text-muted-foreground text-xs">
                        {p('reviewedBy', { name: s.reviewer_name })}
                        {s.reviewed_at ? ` ${p('reviewedAt', { date: formatDate(s.reviewed_at) })}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  {s.status === 'pending' ? (
                    <View className="flex-row gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={approve.running}
                        onPress={async () => {
                          const ok = await confirm({ title: p('approveConfirmTitle'), body: p('approveConfirmDesc', { name, role }), confirmLabel: p('approveConfirm') });
                          if (ok) approve.run(s);
                        }}>
                        <Icon as={Check} className="text-primary-foreground size-4" />
                        <Text>{p('approve')}</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onPress={() => {
                          setReason('');
                          setRejecting(s);
                        }}>
                        <Icon as={X} className="size-4" />
                        <Text>{p('reject')}</Text>
                      </Button>
                    </View>
                  ) : null}
                </CardContent>
              </Card>
            );
          }}
        />
      </View>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('rejectDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Label>{p('rejectReasonLabel')}</Label>
          <Textarea value={reason} onChangeText={setReason} placeholder={p('rejectReasonPlaceholder')} />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={reject.running}
              onPress={async () => {
                if (rejecting && (await reject.run(rejecting)).ok) setRejecting(null);
              }}>
              <Text>{p('rejectConfirm')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
