import type { LucideIcon } from 'lucide-react-native';
import { Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const TONES = {
  blue: ['border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20', 'text-blue-600 dark:text-blue-400', 'text-blue-800 dark:text-blue-300'],
  green: ['border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20', 'text-green-600 dark:text-green-400', 'text-green-800 dark:text-green-300'],
  orange: ['border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20', 'text-orange-600 dark:text-orange-400', 'text-orange-800 dark:text-orange-300'],
  amber: ['border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20', 'text-amber-600 dark:text-amber-400', 'text-amber-800 dark:text-amber-300'],
} as const;

/** "How it works" style notice used by the web settings pages. */
export function InfoBanner({ title, children, tone = 'blue' }: { title?: string; children: ReactNode; tone?: keyof typeof TONES }) {
  const [box, icon, text] = TONES[tone];
  return (
    <View className={cn('flex-row gap-3 rounded-lg border p-3', box)}>
      <Icon as={Info} className={cn('mt-0.5 size-4', icon)} />
      <View className="flex-1 gap-1">
        {title ? <Text className={cn('text-sm font-medium', text)}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={cn('text-sm', text)}>{children}</Text> : children}
      </View>
    </View>
  );
}

/** Label + hint + switch in a bordered row. */
export function SwitchRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View className="border-border flex-row items-center gap-3 rounded-lg border p-3">
      <View className="flex-1">
        <Text className="font-medium">{label}</Text>
        {hint ? <Text className="text-muted-foreground text-sm">{hint}</Text> : null}
      </View>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </View>
  );
}

/** Titled card with an optional icon and description. */
export function SettingsCard({ title, description, icon, children }: { title: string; description?: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <View className="flex-row items-center gap-2">
          {icon ? <Icon as={icon} className="text-primary size-5" /> : null}
          <CardTitle>{title}</CardTitle>
        </View>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="gap-3 px-4">{children}</CardContent>
    </Card>
  );
}
