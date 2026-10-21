import type { LucideIcon } from 'lucide-react-native';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

// Loading / empty / error states (Figma "System states").

/** Skeleton card while a list loads: a header block, then rows with an avatar and two lines. */
export function LoadingList({ rows = 6 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3 p-4" accessibilityLabel={t('common.loading')}>
      <View className="border-border bg-card gap-3 rounded-2xl border p-4">
        <Skeleton className="h-3.5 w-3/4 rounded-full" />
        <Skeleton className="h-3.5 w-1/2 rounded-full" />
        <Skeleton className="h-3.5 w-2/3 rounded-full" />
      </View>
      <View className="border-border bg-card gap-4 rounded-2xl border p-4">
        {Array.from({ length: Math.max(1, rows - 1) }, (_, i) => (
          <View key={i} className="flex-row items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-3.5 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Message({
  icon,
  title,
  body,
  actionLabel,
  actionIcon,
  onAction,
  tone = 'muted',
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  tone?: 'muted' | 'destructive' | 'warning';
}) {
  const iconTone = tone === 'destructive' ? 'bg-destructive-soft text-destructive' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground';
  return (
    <View className="flex-1 justify-center gap-3 p-4">
      <View className="border-border bg-card items-center gap-2 rounded-2xl border px-6 py-8">
        <View className={`mb-1 size-12 items-center justify-center rounded-full ${iconTone.split(' ')[0]}`}>
          <Icon as={icon} className={`size-5 ${iconTone.split(' ')[1]}`} />
        </View>
        <Text className="text-center text-base font-semibold">{title}</Text>
        {body ? <Text className="text-muted-foreground text-center text-sm">{body}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Button variant="outline" onPress={onAction}>
          {actionIcon ? <Icon as={actionIcon} className="size-4" /> : null}
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function EmptyState(props: { icon?: LucideIcon; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return <Message icon={props.icon ?? Inbox} {...props} />;
}

/** Error with retry. `offline` swaps in the no-connection wording and a "Retry connection" button. */
export function ErrorState({ message, onRetry, offline }: { message?: string; onRetry?: () => void; offline?: boolean }) {
  const { t } = useTranslation();
  return (
    <Message
      icon={offline ? WifiOff : AlertTriangle}
      tone={offline ? 'warning' : 'destructive'}
      title={offline ? t('app.offline_title') : t('app.error_title')}
      body={offline ? t('app.offline_body') : message}
      actionLabel={onRetry ? (offline ? t('app.retry_connection') : t('app.retry')) : undefined}
      actionIcon={RefreshCw}
      onAction={onRetry}
    />
  );
}
