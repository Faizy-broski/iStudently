import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface MultiOption {
  id: string;
  label: string;
  hint?: string;
}

/** Searchable multi-select in a sheet (the web's MultiSelectPopover). */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  title,
  emptyMessage,
  invalid,
}: {
  options: MultiOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  title?: string;
  emptyMessage?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = new Set(value);
  const term = q.trim().toLowerCase();
  const shown = term ? options.filter((o) => o.label.toLowerCase().includes(term) || (o.hint ?? '').toLowerCase().includes(term)) : options;
  const summary = value.length === 0 ? (placeholder ?? '') : value.length <= 2 ? options.filter((o) => selected.has(o.id)).map((o) => o.label).join(', ') : t('app.ms_selected', { count: value.length });
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className={cn('border-input bg-background min-h-10 flex-row items-center gap-2 rounded-md border px-3 py-2', invalid && 'border-destructive')}>
        <Text className={cn('flex-1', value.length === 0 && 'text-muted-foreground')} numberOfLines={2}>
          {summary}
        </Text>
        <Icon as={ChevronDown} className="text-muted-foreground size-4" />
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{title ?? placeholder ?? ''}</DialogTitle>
          </DialogHeader>
          <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
          <View className="flex-row justify-between">
            <Button size="sm" variant="ghost" onPress={() => onChange([...new Set([...value, ...shown.map((o) => o.id)])])}>
              <Text className="text-primary">{t('app.at_select_all')}</Text>
            </Button>
            <Button size="sm" variant="ghost" onPress={() => onChange(value.filter((v) => !shown.some((o) => o.id === v)))}>
              <Text className="text-muted-foreground">{t('app.ms_clear')}</Text>
            </Button>
          </View>
          <FlatList
            data={shown}
            keyExtractor={(o) => o.id}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text className="text-muted-foreground py-6 text-center">{emptyMessage ?? t('app.ms_none')}</Text>}
            renderItem={({ item: o }) => {
              const on = selected.has(o.id);
              return (
                <Pressable onPress={() => toggle(o.id)} className={cn('flex-row items-center gap-3 rounded-md px-2 py-2.5', on && 'bg-accent')} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <View className={cn('size-5 items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-input')}>
                    {on ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}
                  </View>
                  <View className="flex-1">
                    <Text>{o.label}</Text>
                    {o.hint ? <Text className="text-muted-foreground text-xs">{o.hint}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
          <DialogFooter>
            <Button onPress={() => setOpen(false)}>
              <Text>{t('app.ms_done', { count: value.length })}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
