import { Stack } from 'expo-router';

// Becomes this role's tab navigator in its sprint.
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
