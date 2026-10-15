import type { HifziDivisionUnit } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen, Save } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useHz, useRiwayat } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

const UNITS: HifziDivisionUnit[] = ['juz', 'hizb', 'rub', 'thumn'];

type Draft = { ministryGrade: string; riwayahId: string; unitType: HifziDivisionUnit; start: string; end: string; label: string };

/** Ministerial Decree 1205: each grade level's mandated memorization range for the current year (web: /admin/hifzi/curriculum). */
export default function HifziCurriculum() {
  const { h, isAr } = useHz('curriculum');
  const toast = useToast();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const riwayat = useRiwayat();
  const year = useApi(['admin', 'academic-year-current'], () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;
  const targets = useApi(yearId ? ['admin', 'hifzi-syllabus', yearId, campusId ?? 'school'] : null, ([, , y]) => adminHifzi.syllabusTargets(y as string, campusId));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const byGrade = new Map((targets.data ?? []).map((t) => [t.grade_level_id, t]));
  const firstRiwayah = (riwayat.data ?? [])[0]?.id ?? '';
  // Like the web, the form starts empty (the stored range is ayah ids, not division numbers); only the label is prefilled.
  const draftFor = (gradeId: string): Draft => drafts[gradeId] ?? { ministryGrade: '', riwayahId: firstRiwayah, unitType: 'thumn', start: '', end: '', label: byGrade.get(gradeId)?.unit_label ?? '' };
  const patch = (gradeId: string, p: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [gradeId]: { ...draftFor(gradeId), ...p } }));

  async function save(gradeId: string) {
    const d = draftFor(gradeId);
    const mg = Number(d.ministryGrade);
    const start = Number(d.start);
    const end = Number(d.end);
    if (!mg || mg < 1 || mg > 12) return toast.error(h('invalidMinistryGrade'));
    if (!d.riwayahId || !start || !end) return toast.error(h('incompleteRange'));
    if (!yearId) return;
    setSaving(gradeId);
    try {
      const res = await adminHifzi.upsertSyllabusTarget(
        { grade_level_id: gradeId, ministry_grade_number: mg, academic_year_id: yearId, riwayah_id: d.riwayahId, range: { unit_type: d.unitType, start_number: start, end_number: end }, unit_label: d.label || undefined },
        campusId,
      );
      if (!res.success) return toast.error(res.error || h('saveError'));
      toast.success(h('saveSuccess'));
      targets.mutate();
    } finally {
      setSaving(null);
    }
  }

  const loading = grades.isLoading || riwayat.isLoading || year.isLoading || targets.isLoading;
  const num = (v: string) => v.replace(/\D/g, '');
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (grades.mutate(), targets.mutate())} />}>
          <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
          {loading ? (
            <LoadingList rows={4} />
          ) : grades.error ? (
            <ErrorState message={grades.error.message} onRetry={() => grades.mutate()} />
          ) : !(grades.data ?? []).length ? (
            <EmptyState icon={BookOpen} title={h('noGradeLevels')} />
          ) : (
            (grades.data ?? []).map((g) => {
              const d = draftFor(g.id);
              const existing = byGrade.get(g.id);
              return (
                <Card key={g.id}>
                  <CardContent className="gap-3 pt-4">
                    <View>
                      <Text className="font-semibold">{g.name}</Text>
                      {existing ? <Text className="text-xs text-green-600">{existing.unit_label || h('mapped')}</Text> : null}
                    </View>
                    <View className="flex-row gap-2">
                      <View className="w-24 gap-1.5">
                        <Label>{h('ministryGrade')}</Label>
                        <Input value={d.ministryGrade} onChangeText={(v) => patch(g.id, { ministryGrade: num(v) })} keyboardType="number-pad" maxLength={2} />
                      </View>
                      <View className="flex-1 gap-1.5">
                        <Label>{h('riwayah')}</Label>
                        <Picker value={d.riwayahId} onChange={(v) => patch(g.id, { riwayahId: v })} options={(riwayat.data ?? []).map((r) => ({ value: r.id, label: isAr ? r.name_ar : r.name_en }))} />
                      </View>
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-1 gap-1.5">
                        <Label>{h('unitType')}</Label>
                        <Picker value={d.unitType} onChange={(v) => patch(g.id, { unitType: v as HifziDivisionUnit })} options={UNITS.map((u) => ({ value: u, label: h(`unitTypes.${u}`) }))} />
                      </View>
                      <View className="w-20 gap-1.5">
                        <Label>{h('from')}</Label>
                        <Input value={d.start} onChangeText={(v) => patch(g.id, { start: num(v) })} keyboardType="number-pad" />
                      </View>
                      <View className="w-20 gap-1.5">
                        <Label>{h('to')}</Label>
                        <Input value={d.end} onChangeText={(v) => patch(g.id, { end: num(v) })} keyboardType="number-pad" />
                      </View>
                    </View>
                    <View className="gap-1.5">
                      <Label>{h('unitLabel')}</Label>
                      <Input value={d.label} onChangeText={(v) => patch(g.id, { label: v })} placeholder={h('unitLabelPlaceholder')} />
                    </View>
                    <Button size="sm" onPress={() => save(g.id)} disabled={saving === g.id}>
                      <Icon as={Save} className="text-primary-foreground size-4" />
                      <Text>{h('save')}</Text>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
