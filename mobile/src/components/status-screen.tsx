import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatusAction {
  label: string;
  onPress(): void;
  primary?: boolean;
}

/** Full-screen message with actions: loading, errors, gates, web-only roles. Final design in Sprints 3-4. */
export function StatusScreen({
  title,
  body,
  actions = [],
  busy,
  children,
}: {
  title?: string;
  body?: string;
  actions?: StatusAction[];
  busy?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {busy && <ActivityIndicator color={theme.primary} size="large" />}
      {title && <ThemedText type="subtitle">{title}</ThemedText>}
      {body && <ThemedText themeColor="textSecondary">{body}</ThemedText>}
      {children}
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            style={[
              styles.button,
              a.primary ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText style={{ color: a.primary ? theme.onPrimary : theme.text }}>{a.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
});
