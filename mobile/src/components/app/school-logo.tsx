import { Image } from 'expo-image';
import { School } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type LogoShape = 'circle' | 'rounded' | 'square' | 'rectangle';

const SHAPE: Record<LogoShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-none',
  rectangle: 'rounded-md',
};

/** School logo in the school's chosen frame (schools.logo_* / school_settings.logo_shape). */
export function SchoolLogo({
  url,
  shape = 'rounded',
  size = 40,
  borderWidth = 0,
  borderColor,
  className,
}: {
  url?: string | null;
  shape?: LogoShape | null;
  size?: number;
  borderWidth?: number | null;
  borderColor?: string | null;
  className?: string;
}) {
  const s = shape ?? 'rounded';
  const width = s === 'rectangle' ? Math.round(size * 1.6) : size;
  return (
    <View
      className={cn('bg-muted items-center justify-center overflow-hidden', SHAPE[s], className)}
      style={{ width, height: size, borderWidth: borderWidth ?? 0, borderColor: borderColor ?? undefined }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Icon as={School} className="text-muted-foreground size-5" />
      )}
    </View>
  );
}
