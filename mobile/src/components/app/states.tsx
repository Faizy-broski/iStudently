import type { LucideIcon } from 'lucide-react-native';
import { AlertTriangle, Inbox, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

export function LoadingList({ rows = 6 }: { rows?: number }) {
  return (
    <View className="gap-3 p-4" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </View>
        </View>
      ))}
    </View>
  );
}

function Message({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = 'muted',
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'muted' | 'destructive';
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8">
      <Icon as={icon} className={tone === 'destructive' ? 'text-destructive size-10' : 'text-muted-foreground size-10'} />
      <Text className="text-center text-lg font-semibold">{title}</Text>
      {body ? <Text className="text-muted-foreground text-center">{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button variant="outline" onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function EmptyState(props: { icon?: LucideIcon; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return <Message icon={props.icon ?? Inbox} {...props} />;
}

/** Error with retry. `offline` swaps in the no-connection wording. */
export function ErrorState({ message, onRetry, offline }: { message?: string; onRetry?: () => void; offline?: boolean }) {
  const { t } = useTranslation();
  return (
    <Message
      icon={offline ? WifiOff : AlertTriangle}
      tone={offline ? 'muted' : 'destructive'}
      title={offline ? t('app.offline_title') : t('app.error_title')}
      body={offline ? t('app.offline_body') : message}
      actionLabel={onRetry ? t('app.retry') : undefined}
      onAction={onRetry}
    />
  );
}
