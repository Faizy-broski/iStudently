import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Round photo, or initials when there is no photo. */
export function PersonAvatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />;
  }
  return (
    <View className="bg-info-soft items-center justify-center rounded-full" style={{ width: size, height: size }}>
      <Text className="text-brand dark:text-brand-secondary font-bold" style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
