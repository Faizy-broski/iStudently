import type { EventCategory, SchoolEvent } from '@studently/api-client';
import { Bell, BookOpen, Calendar, FileText, Users, Zap, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

// Shared by the events calendar, list, details and form (web: admin/events, EventFormDialog, EventDetailsDialog).

export const EVENT_CATEGORIES: EventCategory[] = ['academic', 'holiday', 'exam', 'meeting', 'activity', 'reminder'];

/** Calendar page colours (web: EVENT_COLORS); also the form's default colour per category. */
export const EVENT_COLORS: Record<EventCategory, string> = {
  academic: '#3b82f6',
  holiday: '#ef4444',
  exam: '#f59e0b',
  meeting: '#8b5cf6',
  activity: '#10b981',
  reminder: '#6b7280',
};

export const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  academic: BookOpen,
  holiday: Calendar,
  exam: FileText,
  meeting: Users,
  activity: Zap,
  reminder: Bell,
};

export const AUDIENCE_ROLES = ['teacher', 'student', 'parent'] as const;

export const ymdOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function CategoryBadge({ category }: { category: EventCategory }) {
  const { t } = useTranslation();
  const color = EVENT_COLORS[category];
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}22` }}>
      <Icon as={CATEGORY_ICONS[category]} size={12} color={color} />
      <Text className="text-xs" style={{ color }}>
        {t(`school.events.categories.${category}`)}
      </Text>
    </View>
  );
}

/** One event row: colour bar, title, description, time. */
export function EventLine({ event, locale }: { event: SchoolEvent; locale: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-3">
      <View className="w-1 self-stretch rounded-full" style={{ backgroundColor: event.color_code || '#6b7280' }} />
      <View className="flex-1">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {event.title}
        </Text>
        {event.description ? (
          <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <Text className="text-muted-foreground mt-1 text-xs">
          {event.is_all_day ? t('app.ev_all_day') : new Date(event.start_at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}
