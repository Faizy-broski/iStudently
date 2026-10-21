import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

/** Label + value line for detail screens; empty values show "Not provided". */
export function InfoRow({ label, value, icon, onPress }: { label: string; value?: ReactNode; icon?: LucideIcon; onPress?: () => void }) {
  const { t } = useTranslation();
  const empty = value === null || value === undefined || value === '';
  const body = (
    <View className="flex-row items-center gap-3 py-2.5">
      {icon ? (
        <View className="bg-info-soft size-8 items-center justify-center rounded-full">
          <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text className="text-muted-foreground text-[11px]">{label}</Text>
        {typeof value === 'string' || typeof value === 'number' || empty ? (
          <Text selectable className={empty ? 'text-muted-foreground text-sm italic' : onPress ? 'text-brand-secondary text-sm font-medium' : 'text-sm font-medium'}>
            {empty ? t('school.students.student_details.not_provided') : String(value)}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
  return onPress && !empty ? (
    <Pressable onPress={onPress} accessibilityRole="link">
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Titled card holding InfoRows separated by hairlines. */
export function InfoCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-4">
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 ? <Separator /> : null}
            {r}
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
