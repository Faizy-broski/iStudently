import type { GradeLevel } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ArrowRight, GraduationCap, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const GRADUATE = 'GRADUATE';

/** Which grade each grade promotes to at rollover, the resulting path, and "save all" (web: /admin/settings/grade-progression). */
export default function GradeProgression() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.gp_${key}`, o);
  const toast = useToast();
  // The web reads the school's grades (not a campus).
  const q = useApi(['admin', 'grades', 'school'], () => adminAcademics.grades(undefined));
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  if (q.isLoading) return <LoadingList rows={5} />;
  const grades: GradeLevel[] = [...(q.data ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const nextOf = (g: GradeLevel) => (g.id in edits ? edits[g.id] : (g.next_grade_id ?? null));

  // Path from the lowest grade, following next grades (loop-safe, max 20 like the web).
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: GradeLevel | undefined = grades[0];
  while (current && chain.length < 20 && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current.name);
    const nid: string | null = nextOf(current);
    if (!nid) {
      chain.push(GRADUATE);
      break;
    }
    current = grades.find((g) => g.id === nid);
  }

  async function setNext(g: GradeLevel, value: string) {
    const next = value === GRADUATE ? null : value || null;
    setEdits((e) => ({ ...e, [g.id]: next }));
    const r = await adminAcademics.updateGrade(g.id, { next_grade_id: next });
    if (!r.success) return toast.error(r.error || k('update_failed'));
    toast.success(k('updated'));
  }

  async function saveAll() {
    setSaving(true);
    let ok = 0;
    for (const g of grades) {
      const r = await adminAcademics.updateGrade(g.id, { next_grade_id: nextOf(g) });
      if (r.success) ok++;
    }
    setSaving(false);
    if (ok === grades.length) toast.success(k('all_saved'));
    else toast.error(k('partial_saved', { ok, total: grades.length }));
    q.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">
          {k('subtitle')}
        </Text>
        {chain.length ? (
          <Panel className="gap-2 p-4">
            <Text className="font-semibold">{k('path_title')}</Text>
            <View className="flex-row flex-wrap items-center gap-2">
              {chain.map((name, i) => (
                <View key={`${name}:${i}`} className="flex-row items-center gap-2">
                  <View className={cn('flex-row items-center gap-1 rounded-lg px-3 py-1.5', name === GRADUATE ? 'bg-success-soft' : 'bg-info-soft')}>
                    {name === GRADUATE ? <Icon as={GraduationCap} className="text-success size-4" /> : null}
                    <Text className={cn('text-sm font-medium', name === GRADUATE ? 'text-success' : 'text-brand dark:text-brand-secondary')}>{name === GRADUATE ? k('graduate') : name}</Text>
                  </View>
                  {i < chain.length - 1 ? <Icon as={ArrowRight} flipRtl className="text-muted-foreground size-4" /> : null}
                </View>
              ))}
            </View>
          </Panel>
        ) : null}
        <Panel className="gap-3 p-4">
          <Text className="font-semibold">{k('config_title')}</Text>
          <Text variant="muted" className="text-xs">
            {k('config_desc')}
          </Text>
          {!grades.length ? <Text variant="muted">{k('empty')}</Text> : null}
          {grades.map((g) => {
            const options = grades.filter((x) => (x.order_index ?? 0) > (g.order_index ?? 0) && x.is_active !== false);
            return (
              <View key={g.id} className="border-border gap-1.5 rounded-xl border p-3">
                <Text className="text-sm font-semibold">{g.name}</Text>
                <Picker value={nextOf(g) ?? GRADUATE} onChange={(v) => setNext(g, v)} options={[{ value: GRADUATE, label: k('graduate') }, ...options.map((x) => ({ value: x.id, label: x.name }))]} />
              </View>
            );
          })}
          <Button onPress={saveAll} disabled={saving || !grades.length}>
            {saving ? <ActivityIndicator size="small" /> : <Icon as={Save} className="text-primary-foreground size-4" />}
            <Text>{k('save_all')}</Text>
          </Button>
        </Panel>
      </ScrollView>
    </>
  );
}
