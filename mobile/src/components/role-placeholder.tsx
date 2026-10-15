import type { MobileRoleGroup } from '@studently/shared-types';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useFeatures } from '@/features/auth/use-features';
import { useTheme } from '@/hooks/use-theme';

// Home placeholder for each role route group until its sprint builds the real tabs.
export function RolePlaceholder({ group, sprint }: { group: MobileRoleGroup; sprint: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { me, signOut } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const school = me.status === 'ready' ? me.me.school : null;
  const features = useFeatures();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText type="subtitle">{group}</ThemedText>
      <ThemedText themeColor="textSecondary">Built in {sprint}</ThemedText>
      {profile && (
        <ThemedText type="small">
          {[profile.first_name, profile.last_name].filter(Boolean).join(' ')} · {profile.role}
          {school ? ` · ${school.name}` : ''}
        </ThemedText>
      )}
      {features.enabled.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {features.enabled.join(' · ')}
        </ThemedText>
      )}
      {__DEV__ && (
        <Link href="/dev">
          <ThemedText type="link">Sprint 1 spikes</ThemedText>
        </Link>
      )}
      <Pressable onPress={signOut} accessibilityRole="button">
        <ThemedText type="link">{t('app.sign_out')}</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.two, justifyContent: 'center' },
});
