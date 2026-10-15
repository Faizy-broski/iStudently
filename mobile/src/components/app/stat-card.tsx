import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Dashboard number tile. */
export function StatCard({ icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail?: string; tone?: 'warning' | 'destructive' }) {
  return (
    <Card className="flex-1 gap-1 py-4">
      <CardContent className="gap-1 px-4">
        <View className="flex-row items-center gap-2">
          <Icon as={icon} className={cn('size-4', tone === 'warning' ? 'text-warning' : tone === 'destructive' ? 'text-destructive' : 'text-primary')} />
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text className="text-2xl font-bold">{value}</Text>
        {detail ? (
          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
