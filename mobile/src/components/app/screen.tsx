import type { ReactNode } from 'react';
import { View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ScrollView } from '@/components/app/keyboard';
import { cn } from '@/lib/utils';

/** Page wrapper: safe area + theme background. `scroll` for forms and detail pages. */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top', 'bottom'],
  className,
  contentContainerClassName,
  scrollProps,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  className?: string;
  contentContainerClassName?: string;
  scrollProps?: ScrollViewProps;
}) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={cn(padded && 'p-4', 'gap-4 pb-8', contentContainerClassName)}
          {...scrollProps}>
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1', padded && 'p-4', contentContainerClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
