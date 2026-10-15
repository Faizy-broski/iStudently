import type { GlobalPage } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, FileText, Image as ImageIcon, Link2, Plus, SquareCode } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { ListRow } from '@/components/app/list-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const TYPE_ICON = { url: Link2, embed: SquareCode, text: FileText, image: ImageIcon } as const;

export default function PublicPagesList() {
  const { t } = useTranslation();
  const pages = useApi(['platform', 'global-pages'], () => platform.listGlobalPages());
  const reorder = useAction(platform.reorderGlobalPages);
  const toggle = useAction((p: GlobalPage) => platform.updateGlobalPage(p.id, { isActive: !p.isActive }), { onSuccess: () => pages.mutate() });
  const sorted = [...(pages.data ?? [])].sort((a, b) => a.order - b.order);

  async function move(p: GlobalPage, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    pages.mutate(next.map((x, k) => ({ ...x, order: k })), { revalidate: false });
    if (!(await reorder.run(next.map((x) => x.id))).ok) pages.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('app.pp_title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/superadmin/public-pages/form')} accessibilityLabel={t('app.pp_new')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={pages.data ? sorted : undefined}
          error={pages.error}
          isLoading={pages.isLoading}
          isRefreshing={pages.isValidating && !pages.isLoading}
          onRefresh={() => pages.mutate()}
          emptyTitle={t('app.pp_none')}
          emptyBody={t('app.pp_none_body')}
          keyExtractor={(p) => p.id}
          renderItem={(p, i) => (
            <ListRow
              title={p.title}
              subtitle={[
                t(`app.pp_type_${p.page_type}`),
                p.visible_to_roles?.length ? p.visible_to_roles.map((r) => t(`app.pp_role_${r}`)).join(', ') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              leading={<Icon as={TYPE_ICON[p.page_type] ?? FileText} className="text-muted-foreground size-5" />}
              trailing={
                <View className="flex-row items-center gap-3">
                  {p.is_template ? (
                    <Badge variant="outline">
                      <Text>{t('app.pp_status_draft')}</Text>
                    </Badge>
                  ) : null}
                  <Switch checked={p.isActive} onCheckedChange={() => toggle.run(p)} accessibilityLabel={t('app.pp_active')} />
                  <Pressable onPress={() => move(p, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={t('app.ib_move_up')}>
                    <Icon as={ArrowUp} className={i === 0 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
                  </Pressable>
                  <Pressable onPress={() => move(p, 1)} disabled={i === sorted.length - 1} hitSlop={8} accessibilityLabel={t('app.ib_move_down')}>
                    <Icon as={ArrowDown} className={i === sorted.length - 1 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
                  </Pressable>
                </View>
              }
              chevron={false}
              onPress={() => router.push({ pathname: '/superadmin/public-pages/form', params: { id: p.id } })}
            />
          )}
        />
      </View>
    </>
  );
}
