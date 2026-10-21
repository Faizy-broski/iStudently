import { AlertCircle } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** The red "Error loading …" card the web's role pages show when a fetch fails. */
export function PortalError({ title, message }: { title: string; message?: string }) {
  return (
    <View className="bg-background flex-1 p-4">
      <Card className="border-destructive/30 bg-destructive-soft ">
        <CardContent className="flex-row items-center gap-3 p-4">
          <Icon as={AlertCircle} className="size-8 text-destructive" />
          <View className="flex-1">
            <Text className="font-semibold text-destructive ">{title}</Text>
            {message ? <Text className="text-sm text-destructive ">{message}</Text> : null}
          </View>
        </CardContent>
      </Card>
    </View>
  );
}

/** Web gradeColor / progressColor: ≥90 green, ≥80 blue, ≥70 yellow, else red; grey when ungraded. */
export function gradeTone(avg: number | null | undefined) {
  if (avg == null) return { text: 'text-muted-foreground', bar: 'bg-muted-foreground/40' };
  if (avg >= 90) return { text: 'text-success', bar: 'bg-success' };
  if (avg >= 80) return { text: 'text-brand dark:text-brand-secondary', bar: 'bg-brand' };
  if (avg >= 70) return { text: 'text-warning', bar: 'bg-warning' };
  return { text: 'text-destructive', bar: 'bg-destructive' };
}

/** Thin progress bar with a coloured fill (0-100). */
export function Bar({ value, tone, className }: { value: number; tone: string; className?: string }) {
  return (
    <View className={`bg-muted h-1.5 overflow-hidden rounded-full ${className ?? ''}`}>
      <View className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </View>
  );
}
