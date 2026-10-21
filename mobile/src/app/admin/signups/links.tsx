import { signupUrl, type SignupLink } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Share2, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminSignups } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';

/** Invitation links people use to sign themselves up (web: /admin/signup-links). */
export default function SignupLinks() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`signupLinks.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const links = useApi(['admin', 'signup-links', campusId ?? 'school'], () => adminSignups.links(campusId));
  const toggle = useAction((l: SignupLink) => adminSignups.setLinkActive(l.id, !l.is_active), { onSuccess: () => links.mutate() });
  const remove = useAction((l: SignupLink) => adminSignups.deleteLink(l.id), { success: s('delete'), onSuccess: () => links.mutate() });

  // Web sort: created (newest first by default), uses or expiry ("never" always last).
  const [sort, setSort] = useState<{ field: 'created_at' | 'use_count' | 'expires_at'; dir: 1 | -1 }>({ field: 'created_at', dir: -1 });
  const sorted = links.data
    ? [...links.data].sort((a, b) => {
        if (sort.field === 'use_count') return (a.use_count - b.use_count) * sort.dir;
        if (sort.field === 'expires_at') {
          const at = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
          const bt = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
          if (at === Infinity && bt === Infinity) return 0;
          if (at === Infinity) return 1;
          if (bt === Infinity) return -1;
          return (at - bt) * sort.dir;
        }
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sort.dir;
      })
    : undefined;

  const expired = (l: SignupLink) => (!!l.expires_at && new Date(l.expires_at) < new Date()) || (l.max_uses !== null && l.use_count >= l.max_uses);

  return (
    <>
      <Stack.Screen
        options={{
          title: s('pageTitle'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/admin/signups/link-form')} accessibilityLabel={s('generateBtn')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={sorted}
          header={
            <View className="flex-row items-center gap-2 px-4 pt-3">
              <View className="flex-1">
                <FilterChips<'created_at' | 'use_count' | 'expires_at'>
                  value={sort.field}
                  onChange={(field) => setSort((x) => ({ field, dir: x.field === field ? x.dir : -1 }))}
                  options={[
                    { value: 'created_at', label: t('app.sl_sort_created') },
                    { value: 'use_count', label: s('tableUses') },
                    { value: 'expires_at', label: s('tableExpires') },
                  ]}
                />
              </View>
              <Pressable onPress={() => setSort((x) => ({ ...x, dir: x.dir === 1 ? -1 : 1 }))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('app.sl_sort_direction')}>
                <Icon as={sort.dir === 1 ? ArrowUp : ArrowDown} className="text-muted-foreground size-5" />
              </Pressable>
            </View>
          }
          error={links.error}
          isLoading={links.isLoading}
          isRefreshing={links.isValidating && !links.isLoading}
          onRefresh={() => links.mutate()}
          emptyTitle={s('emptyTitle')}
          emptyBody={s('emptyDesc')}
          keyExtractor={(l) => l.id}
          contentContainerClassName="flex-grow gap-3 p-4"
          ItemSeparatorComponent={null}
          renderItem={(l) => {
            const url = signupUrl(env.webUrl, l.token);
            const state = !l.is_active ? 'statusInactive' : expired(l) ? 'statusExpired' : 'statusActive';
            return (
              <Card className="gap-2 py-3">
                <CardContent className="gap-2 px-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold" numberOfLines={1}>
                        {l.label || t(`app.role_${l.role}`, { defaultValue: l.role })}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {[
                          t(`app.role_${l.role}`, { defaultValue: l.role }),
                          `${s('tableUses')}: ${l.use_count}/${l.max_uses ?? s('unlimited')}`,
                          `${s('tableExpires')}: ${l.expires_at ? formatDate(l.expires_at) : s('never')}`,
                        ].join(' · ')}
                      </Text>
                    </View>
                    <StatusChip label={s(state)} tone={state === 'statusActive' ? 'success' : state === 'statusExpired' ? 'warning' : 'muted'} className="px-2 py-0.5" />
                  </View>
                  <View className="flex-row items-center gap-4 pt-1">
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel={s('copyLink')}
                      onPress={async () => {
                        await Clipboard.setStringAsync(url);
                        toast.success(s('copied'));
                      }}>
                      <Icon as={Copy} className="text-muted-foreground size-5" />
                    </Pressable>
                    <Pressable hitSlop={8} accessibilityLabel={s('share')} onPress={() => Share.share({ message: url })}>
                      <Icon as={Share2} className="text-muted-foreground size-5" />
                    </Pressable>
                    <Pressable hitSlop={8} accessibilityLabel={t('common.edit')} onPress={() => router.push({ pathname: '/admin/signups/link-form', params: { id: l.id } })}>
                      <Icon as={Pencil} className="text-muted-foreground size-5" />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel={s('deleteConfirmTitle')}
                      onPress={async () => {
                        if (await confirm({ title: s('deleteConfirmTitle'), body: s('deleteConfirmDesc'), destructive: true, confirmLabel: s('deleteConfirm') })) remove.run(l);
                      }}>
                      <Icon as={Trash2} className="text-muted-foreground size-5" />
                    </Pressable>
                    <View className="flex-1" />
                    <Switch checked={l.is_active} onCheckedChange={() => toggle.run(l)} accessibilityLabel={s('tableStatus')} />
                  </View>
                </CardContent>
              </Card>
            );
          }}
        />
      </View>
    </>
  );
}
