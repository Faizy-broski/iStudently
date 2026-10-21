import type { LucideIcon } from 'lucide-react-native';
import { Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { FormSection } from '@/components/app/layout';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const TONES = {
  blue: ['border-info-soft bg-info-soft', 'text-brand dark:text-brand-secondary', 'text-brand dark:text-brand-secondary'],
  green: ['border-success/30 bg-success-soft', 'text-success', 'text-success'],
  orange: ['border-warning/30 bg-warning-soft', 'text-warning', 'text-warning'],
  amber: ['border-warning/30 bg-warning-soft', 'text-warning', 'text-warning'],
} as const;

/** "How it works" style notice used by the web settings pages. */
export function InfoBanner({ title, children, tone = 'blue' }: { title?: string; children: ReactNode; tone?: keyof typeof TONES }) {
  const [box, icon, text] = TONES[tone];
  return (
    <View className={cn('flex-row gap-3 rounded-2xl border p-3.5', box)}>
      <Icon as={Info} className={cn('mt-0.5 size-4', icon)} />
      <View className="flex-1 gap-1">
        {title ? <Text className={cn('text-sm font-semibold', text)}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={cn('text-sm', text)}>{children}</Text> : children}
      </View>
    </View>
  );
}

/** Label + hint + switch in a bordered row. */
export function SwitchRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3">
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold">{label}</Text>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
      </View>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </View>
  );
}

/** Titled card with an optional icon and description. */
export function SettingsCard({ title, description, icon, children }: { title: string; description?: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <FormSection title={title} description={description} icon={icon}>
      <View className="gap-3">{children}</View>
    </FormSection>
  );
}
