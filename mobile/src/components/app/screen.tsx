import type { ReactNode } from 'react';
import { View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
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
  auth,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  className?: string;
  contentContainerClassName?: string;
  scrollProps?: ScrollViewProps;
  /** Sign-in style screens: light background with the logo shape (Figma). */
  auth?: boolean;
}) {
  const page = (
    <SafeAreaView edges={edges} className={cn('flex-1', auth ? 'bg-transparent' : 'bg-background', className)}>
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
  return auth ? <AuthBackground>{page}</AuthBackground> : page;
}
