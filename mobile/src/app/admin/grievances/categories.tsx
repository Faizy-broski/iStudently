import { Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { complaints } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Complaint categories: add and remove (web: /admin/grievances/categories). */
export default function GrievanceCategories() {
  const { t } = useTranslation();
  const c = (k: string) => t(`grievances.categories.${k}`);
  const toast = useToast();
  const list = useApi(['grievance-categories'], () => complaints.getCategories());
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await complaints.createCategory(name.trim());
      if (!res.success) return toast.error(res.error || c('err_add_failed'));
      setName('');
      toast.success(c('msg_added'));
      list.mutate();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const res = await complaints.deleteCategory(id);
    if (!res.success) return toast.error(res.error || c('err_remove_failed'));
    toast.success(c('msg_removed'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: c('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted" className="text-sm">{c('subtitle')}</Text>
              <View className="flex-row gap-2">
                <Input className="flex-1" value={name} onChangeText={setName} placeholder={c('new_category_placeholder')} onSubmitEditing={add} />
                <Button onPress={add} disabled={adding || !name.trim()}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{c('btn_add')}</Text>
                </Button>
              </View>
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={c('title')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="flex-row items-center gap-2 px-4 py-3">
              <Text className="flex-1 text-sm">{x.name}</Text>
              {x.is_default ? (
                <Badge variant="outline">
                  <Text className="text-[10px]">{c('default_badge')}</Text>
                </Badge>
              ) : (
                <Pressable onPress={() => remove(x.id)} hitSlop={8}>
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Pressable>
              )}
            </View>
          )}
        />
      </View>
    </>
  );
}
