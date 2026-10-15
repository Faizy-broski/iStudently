import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Tappable row for lists and settings. Chevron points "forward" in both LTR and RTL. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = !!onPress,
  className,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const content = (
    <View className={cn('min-h-14 flex-row items-center gap-3 px-4 py-3', className)}>
      {leading}
      <View className="flex-1 gap-0.5">
        <Text className="font-medium" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-sm" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon as={I18nManager.isRTL ? ChevronLeft : ChevronRight} className="text-muted-foreground size-5" /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-accent">
      {content}
    </Pressable>
  );
}
