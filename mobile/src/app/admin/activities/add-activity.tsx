import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAc } from '@/features/admin/activities';
import { StudentChecklist, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminActivities } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Add one activity to many students at once (web: /admin/activities/add-activity). */
export default function AddActivity() {
  const a = useAc();
  const toast = useToast();
  const { campusId } = useCampus();
  const activities = useApi(['admin', 'activities', campusId ?? 'school', 'active'], () => adminActivities.activities(campusId));
  const students = useCampusStudents();
  const [activityId, setActivityId] = useState('__none__');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function save() {
    if (activityId === '__none__') return toast.error(a('selectActivityError'));
    if (!selected.size) return toast.error(a('selectStudentError'));
    setSaving(true);
    try {
      const r = await adminActivities.enrollStudents(activityId, [...selected], campusId);
      if (!r.success) return toast.error(r.error || a('failedToAddStudentsToActivity'));
      toast.success(a('studentsAddedToActivity', { count: selected.size }));
      setSelected(new Set());
    } finally {
      setSaving(false);
    }
  }

  const button = (
    <Button onPress={save} disabled={saving}>
      <Icon as={Plus} className="text-primary-foreground size-4" />
      <Text>{a('addActivityToSelectedStudents')}</Text>
    </Button>
  );
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('addActivity') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-1.5 pt-4">
            <Label>{a('activity')}</Label>
            {activities.isLoading ? (
              <LoadingList rows={1} />
            ) : (
              <Picker
                value={activityId}
                onChange={setActivityId}
                options={[{ value: '__none__', label: a('notApplicable') }, ...(activities.data ?? []).map((x) => ({ value: x.id, label: x.title }))]}
              />
            )}
          </CardContent>
        </Card>
        {button}
        <Text className="text-muted-foreground text-sm">{a('selectedCount', { count: selected.size })}</Text>
        <StudentChecklist students={students.data ?? []} loading={students.isLoading} selected={selected} onChange={setSelected} countKey="activities.studentsFound" />
        {selected.size > 5 ? button : null}
      </ScrollView>
    </View>
  );
}
