import type { ReportPersonOption, ReportRole } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, Filter, GraduationCap, SlidersHorizontal, UserCheck, UserCircle, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { REPORT_ENTITY, REPORT_FIELDS } from '@/features/admin/advanced-report';
import { ConfidentialBadge } from '@/features/admin/people-extras';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminAnalytics, adminCustomFields } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const ROLES: ReportRole[] = ['student', 'teacher', 'staff', 'librarian', 'parent'];
const ROLE_ICON = { student: GraduationCap, teacher: UserCheck, staff: Users, librarian: BookOpen, parent: UserCircle };
const EMPLOYEE_ROLES: ReportRole[] = ['teacher', 'staff', 'librarian'];

/**
 * Pick a group of people (or one person) and the columns you want, then open the results
 * (web: /admin/students/advanced-report).
 */
export default function AdvancedReport() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`admin.reports.advanced_report.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const key = campusId ?? 'school';
  const [role, setRole] = useState<ReportRole>('student');
  const [fields, setFields] = useState<string[]>(['first_name', 'last_name', 'student_number']);
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [department, setDepartment] = useState('');
  const [siblings, setSiblings] = useState<'_all' | 'true' | 'false'>('_all');
  const [person, setPerson] = useState<ReportPersonOption | null>(null);
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const entity = REPORT_ENTITY[role] ?? null;
  const isEmployee = EMPLOYEE_ROLES.includes(role);
  const roleLabel = r(`roles.${role}`);

  const defs = useApi(entity ? ['admin', 'custom-fields', entity, key] : null, ([, , kind]) => adminCustomFields.list(kind as 'student' | 'teacher' | 'staff' | 'parent', campusId));
  const grades = useApi(role === 'student' ? ['admin', 'grades', key] : null, () => adminAcademics.grades(campusId));
  const sections = useApi(gradeId ? ['admin', 'sections', key, gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  // Same as the web picker: results refresh as you type and follow the grade/section/department filters.
  const people = useApi(person ? null : ['admin', 'report-person', key, role, q, gradeId, sectionId, isEmployee ? department.trim() : ''], () =>
    adminAnalytics.advancedReportSearch(role, campusId, {
      q,
      grade_level_id: role === 'student' ? gradeId || undefined : undefined,
      section_id: role === 'student' ? sectionId || undefined : undefined,
      department: isEmployee ? department.trim() || undefined : undefined,
    }),
  );

  const gradeList = (grades.data ?? []).filter((g) => g.is_active !== false);
  const sectionList = (sections.data ?? []).filter((s) => s.is_active !== false);
  const custom = (defs.data ?? []).filter((d) => d.is_active !== false);
  const byCategory = custom.reduce<Record<string, typeof custom>>((acc, d) => {
    const c = d.category_name || d.category_id;
    return { ...acc, [c]: [...(acc[c] ?? []), d] };
  }, {});
  const standard = REPORT_FIELDS[role].map((id) => ({ id, label: id === 'username' ? t('common.username') : id === 'password' ? t('app.sl_password') : r(`fields.${id}`) }));

  function changeRole(next: ReportRole) {
    setRole(next);
    setGradeId('');
    setSectionId('');
    setDepartment('');
    setSiblings('_all');
    setPerson(null);
    setQuery('');
    setFields(REPORT_FIELDS[next].slice(0, 3));
  }
  const toggle = (id: string) => setFields((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = (ids: string[]) => setFields((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  const clearFilters = () => {
    setGradeId('');
    setSectionId('');
    setDepartment('');
    setSiblings('_all');
    setPerson(null);
  };

  const active: string[] = [];
  if (person) active.push(person.label);
  else {
    if (gradeId) active.push(`${r('grade_level')}: ${gradeList.find((g) => g.id === gradeId)?.name ?? gradeId}`);
    if (sectionId) active.push(`${r('section')}: ${sectionList.find((s) => s.id === sectionId)?.name ?? sectionId}`);
    if (department) active.push(`${r('department')}: ${department}`);
    if (role === 'student' && siblings !== '_all') active.push(`${r('family')}: ${r(siblings === 'true' ? 'family_with_siblings' : 'family_without_siblings')}`);
  }

  function generate() {
    if (fields.length === 0) return toast.error(r('select_at_least_one'));
    const params: Record<string, string> = { role, fields: JSON.stringify(fields) };
    if (person) {
      params.user_id = person.id;
      params.user_label = person.label;
    } else {
      if (role === 'student') {
        if (gradeId) params.grade_level_id = gradeId;
        if (sectionId) params.section_id = sectionId;
        if (siblings !== '_all') params.has_siblings = siblings;
      }
      if (isEmployee && department.trim()) params.department = department.trim();
    }
    router.push({ pathname: '/admin/reports/advanced-results', params });
  }

  function checkRow(id: string, label: string) {
    const on = fields.includes(id);
    return (
      <Pressable key={id} onPress={() => toggle(id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="w-1/2 flex-row items-center gap-2 py-1.5 pe-2">
        <Checkbox checked={on} onCheckedChange={() => toggle(id)} />
        <Text className="flex-1 text-sm">{label}</Text>
      </Pressable>
    );
  }

  function groupHeader(title: string, ids: string[], note?: string) {
    return (
      <View className="flex-row items-center justify-between">
        <Text className="text-primary flex-1 text-sm font-semibold">
          {title}
          {note ? <Text className="text-muted-foreground text-xs font-normal">{`  ${note}`}</Text> : null}
        </Text>
        <Button variant="ghost" size="sm" onPress={() => toggleAll(ids)}>
          <Text>{ids.every((id) => fields.includes(id)) ? r('deselect_all') : r('select_all')}</Text>
        </Button>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: r('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{r('subtitle')}</Text>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Users} className="size-5" />
              <CardTitle>{r('select_user_type')}</CardTitle>
            </View>
            <CardDescription>{r('select_user_type_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex-row flex-wrap gap-2 px-4">
            {ROLES.map((x) => (
              <Pressable
                key={x}
                onPress={() => changeRole(x)}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === x }}
                className={cn('min-w-[30%] flex-1 items-center gap-1.5 rounded-xl border-2 p-3', role === x ? 'border-primary bg-primary' : 'border-border bg-card')}>
                <Icon as={ROLE_ICON[x]} className={cn('size-4', role === x ? 'text-primary-foreground' : 'text-foreground')} />
                <Text className={cn('text-sm font-medium', role === x && 'text-primary-foreground')}>{r(`roles.${x}`)}</Text>
              </Pressable>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Icon as={SlidersHorizontal} className="size-5" />
              <CardTitle>{r('filters')}</CardTitle>
              {active.length > 0 ? (
                <Badge>
                  <Text>{r('active_filters', { count: active.length })}</Text>
                </Badge>
              ) : null}
            </View>
            <CardDescription>{r('filters_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            {role === 'student' ? (
              <>
                <View className="gap-1.5">
                  <Label>{r('grade_level')}</Label>
                  <Picker
                    value={gradeId}
                    onChange={(v) => {
                      setGradeId(v);
                      setSectionId('');
                    }}
                    placeholder={r('all_grades')}
                    options={[{ value: '', label: r('all_grades') }, ...gradeList.map((g) => ({ value: g.id, label: g.name }))]}
                  />
                </View>
                <View className="gap-1.5">
                  <Label>{r('section')}</Label>
                  <Picker
                    value={sectionId}
                    onChange={setSectionId}
                    placeholder={gradeId ? r('all_sections') : r('select_grade_first')}
                    options={gradeId ? [{ value: '', label: r('all_sections') }, ...sectionList.map((s) => ({ value: s.id, label: s.name }))] : []}
                  />
                </View>
                <View className="gap-1.5">
                  <Label>{r('family')}</Label>
                  <Picker
                    value={siblings}
                    onChange={(v) => setSiblings(v as '_all' | 'true' | 'false')}
                    options={[
                      { value: '_all', label: r('family_all') },
                      { value: 'true', label: r('family_with_siblings') },
                      { value: 'false', label: r('family_without_siblings') },
                    ]}
                  />
                </View>
              </>
            ) : null}
            {isEmployee ? (
              <View className="gap-1.5">
                <Label>{r('department')}</Label>
                <Input value={department} onChangeText={setDepartment} placeholder={r('department_placeholder')} />
              </View>
            ) : null}

            <View className="flex-row items-center gap-3">
              <View className="bg-border h-px flex-1" />
              <Text className="text-muted-foreground text-xs">{r('or_target_person')}</Text>
              <View className="bg-border h-px flex-1" />
            </View>

            <View className="gap-1.5">
              <Label>{r('specific_person')}</Label>
              {person ? (
                <View className="border-primary/30 bg-primary/5 flex-row items-center gap-2 rounded-xl border px-3 py-2">
                  <Text className="text-primary flex-1 text-sm font-medium">{person.label}</Text>
                  <ConfidentialBadge status={person.confidential_family_status} />
                  <Pressable onPress={() => setPerson(null)} accessibilityRole="button" accessibilityLabel={r('clear_all')} hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <SearchBar value={query} onChangeText={setQuery} placeholder={r('search_by_name', { role: roleLabel.toLowerCase() })} />
                  {people.isLoading ? <ActivityIndicator className="py-2" /> : null}
                  {query.trim() && people.data && people.data.length === 0 ? (
                    <EmptyState title={r('no_found', { role: roleLabel.toLowerCase() })} />
                  ) : null}
                  {query.trim() && (people.data?.length ?? 0) > 0 ? (
                    <View className="border-info-soft dark:border-border max-h-60 rounded-xl border">
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {(people.data ?? []).map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => {
                              setPerson(p);
                              setQuery('');
                              setGradeId('');
                              setSectionId('');
                              setDepartment('');
                            }}
                            className="active:bg-muted flex-row items-center gap-2 px-3 py-2.5">
                            <Text className="flex-1 text-sm" numberOfLines={1}>
                              {p.label}
                            </Text>
                            <ConfidentialBadge status={p.confidential_family_status} />
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </>
              )}
              <Text className="text-muted-foreground text-xs">{r('person_hint')}</Text>
            </View>

            {active.length > 0 ? (
              <View className="flex-row flex-wrap items-center gap-2">
                {active.map((f) => (
                  <View key={f} className="border-primary/30 bg-primary/5 rounded-full border px-2 py-1">
                    <Text className="text-primary text-xs">{f}</Text>
                  </View>
                ))}
                <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={6}>
                  <Text className="text-destructive text-xs">{r('clear_all')}</Text>
                </Pressable>
              </View>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Icon as={Filter} className="size-5" />
              <CardTitle>{r('select_fields')}</CardTitle>
              <Badge variant="secondary">
                <Text>{r('selected_count', { count: fields.length })}</Text>
              </Badge>
            </View>
            <CardDescription>{r('select_fields_desc', { role: roleLabel })}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4 px-4">
            <View className="gap-1">
              {groupHeader(r('standard_fields'), standard.map((f) => f.id))}
              <View className="flex-row flex-wrap">{standard.map((f) => checkRow(f.id, f.label))}</View>
            </View>
            {defs.isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator />
                <Text className="text-muted-foreground text-sm">{r('loading_custom')}</Text>
              </View>
            ) : Object.keys(byCategory).length > 0 ? (
              Object.entries(byCategory).map(([category, list]) => {
                const ids = list.map((d) => `custom_${d.field_key}`);
                return (
                  <View key={category} className="gap-1">
                    {groupHeader(category.toUpperCase(), ids, r('custom_label'))}
                    <View className="flex-row flex-wrap">{list.map((d) => checkRow(`custom_${d.field_key}`, (locale === 'ar' && d.label_ar) || d.label))}</View>
                  </View>
                );
              })
            ) : entity ? (
              <Text className="text-muted-foreground text-sm">{r('no_custom', { role: roleLabel })}</Text>
            ) : null}

            <View className="border-border gap-3 border-t pt-3">
              <Text className="text-muted-foreground text-sm">
                {fields.length === 0 ? r('select_at_least_one') : r(fields.length === 1 ? 'fields_selected' : 'fields_selected_plural', { count: fields.length })}
                {active.length > 0 ? <Text className="text-primary text-sm font-medium">{` · ${active.join(', ')}`}</Text> : null}
              </Text>
              <Button onPress={generate} disabled={fields.length === 0}>
                <Text>{`${r('generate_btn', { role: roleLabel })} →`}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
