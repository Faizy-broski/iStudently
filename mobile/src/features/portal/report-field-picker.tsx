import type { CustomFieldDefinition } from '@studently/api-client';
import { Stack } from 'expo-router';
import { CheckSquare, Filter, Square } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MY_REPORT_FIELDS } from '@/features/portal/my-report';
import { adminCustomFields } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Field picker of the personal / children report (web: /student and /parent students/advanced-report). */
export function ReportFieldPicker({ title, subtitle, onGenerate }: { title: string; subtitle: string; onGenerate: (fields: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ar_${key}`, o);
  const toast = useToast();
  const defs = useApi(['portal', 'custom-field-defs', 'student'], () => adminCustomFields.list('student'));
  const [selected, setSelected] = useState<string[]>(['first_name', 'last_name', 'student_number']);
  const byCat = new Map<string, CustomFieldDefinition[]>();
  for (const f of defs.data ?? []) byCat.set(f.category_name, [...(byCat.get(f.category_name) ?? []), f]);
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = (ids: string[]) => setSelected((p) => (ids.every((id) => p.includes(id)) ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
  const label = (f: CustomFieldDefinition) => (i18n.language === 'ar' && f.label_ar ? f.label_ar : f.label);

  function generate() {
    if (!selected.length) return toast.error(k('need_one'));
    onGenerate(selected);
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{subtitle}</Text>
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Icon as={Filter} className="size-5" />
              <CardTitle>{k('select')}</CardTitle>
            </View>
            <CardDescription>{k('select_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <Group selected={selected} onToggle={toggle} onToggleAll={toggleAll} allLabel={k('select_all')} noneLabel={k('deselect_all')} title={k('general')} ids={MY_REPORT_FIELDS} labels={MY_REPORT_FIELDS.map((f) => k(`f_${f}`))} />
            {[...byCat.entries()].map(([cat, fields]) => (
              <Group key={cat} selected={selected} onToggle={toggle} onToggleAll={toggleAll} allLabel={k('select_all')} noneLabel={k('deselect_all')} title={k('custom', { category: cat.toUpperCase() })} ids={fields.map((f) => `custom_${f.field_key}`)} labels={fields.map(label)} />
            ))}
            <Button onPress={generate} disabled={!selected.length}>
              <Text>{k('generate')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Group(p: { title: string; ids: string[]; labels: string[]; selected: string[]; onToggle: (id: string) => void; onToggleAll: (ids: string[]) => void; allLabel: string; noneLabel: string }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-primary text-sm font-semibold">{p.title}</Text>
        <Button variant="ghost" size="sm" onPress={() => p.onToggleAll(p.ids)}>
          <Text>{p.ids.every((id) => p.selected.includes(id)) ? p.noneLabel : p.allLabel}</Text>
        </Button>
      </View>
      {p.ids.map((id, i) => {
        const on = p.selected.includes(id);
        return (
          <Pressable key={id} onPress={() => p.onToggle(id)} className="flex-row items-center gap-2 py-1" accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Icon as={on ? CheckSquare : Square} className={on ? 'text-primary size-5' : 'text-muted-foreground size-5'} />
            <Text className="text-sm">{p.labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
