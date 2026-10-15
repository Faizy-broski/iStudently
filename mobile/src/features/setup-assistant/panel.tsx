import { SETUP_STEPS, type SetupAssistantRole } from '@studently/shared-types';
import {
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  GraduationCap,
  Layers,
  Settings,
  SlidersVertical,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Award, BookOpen, Building2, CalendarCheck, ClipboardList, Clock, CreditCard, Eye, GraduationCap, Layers, Settings, SlidersVertical, Upload, UserCheck, Users,
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Web SetupAssistantPanel: the role's guided checklist on the dashboard. Shown only when the
 * setup_assistant plugin is on and this role is enabled in the campus's setup_assistant_config.
 * Steps can only be completed (not undone); dismissing hides it for good.
 */
export function SetupAssistantPanel({
  role,
  plugins,
  config,
  onOpen,
}: {
  role: SetupAssistantRole;
  plugins: readonly string[];
  config: Record<string, boolean> | null | undefined;
  onOpen: (href: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const enabled = plugins.includes('setup_assistant') && !!config?.[role];
  const progress = useApi(enabled ? ['portal', 'setup-progress'] : null, () => portal.setupProgress());
  const [extra, setExtra] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const categories = SETUP_STEPS[role] ?? [];
  const total = categories.reduce((n, c) => n + c.steps.length, 0);
  if (!enabled || !progress.data || progress.data.dismissed || dismissed || total === 0) return null;

  const done = new Set([...progress.data.completed_steps, ...extra]);
  const doneCount = categories.reduce((n, c) => n + c.steps.filter((s) => done.has(s.id)).length, 0);
  const allDone = doneCount === total;
  const pct = Math.round((doneCount / total) * 100);

  function complete(id: string) {
    if (done.has(id)) return;
    setExtra((x) => [...x, id]);
    portal.completeSetupStep(id).then((r) => {
      if (!r.success) setExtra((x) => x.filter((s) => s !== id));
      else progress.mutate();
    });
  }

  async function dismiss() {
    setDismissing(true);
    const r = await portal.dismissSetupAssistant();
    setDismissing(false);
    if (r.success) setDismissed(true);
  }

  return (
    <Card className="border-primary/20 gap-0 overflow-hidden py-0">
      <CardContent className="px-0">
        <View className="border-primary/10 flex-row items-center gap-3 border-b px-4 py-3">
          <View className="bg-primary size-9 items-center justify-center rounded-full">
            <Icon as={Sparkles} className="text-primary-foreground size-5" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{t('app.sa_panel_title')}</Text>
            <Text className="text-muted-foreground text-xs">{allDone ? t('app.sa_all_done') : t('app.sa_progress', { done: doneCount, total })}</Text>
          </View>
          <Pressable onPress={() => setCollapsed((c) => !c)} hitSlop={8} accessibilityRole="button" accessibilityLabel={collapsed ? t('app.sa_expand') : t('app.sa_collapse')}>
            <Icon as={collapsed ? ChevronDown : ChevronUp} className="text-muted-foreground size-5" />
          </Pressable>
          <Pressable onPress={dismiss} disabled={dismissing} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('app.sa_dismiss')}>
            <Icon as={X} className="text-muted-foreground size-5" />
          </Pressable>
        </View>
        <View className="px-4 pt-2">
          <View className="bg-muted h-2 overflow-hidden rounded-full">
            <View className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
          </View>
          <Text className="text-primary mt-1 text-end text-xs font-medium">{`${pct}%`}</Text>
        </View>
        {collapsed ? null : (
          <View className="gap-4 px-4 pt-1 pb-4">
            {categories.map((c) => {
              const catDone = c.steps.filter((s) => done.has(s.id)).length;
              return (
                <View key={c.title} className="gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <Icon as={ICONS[c.icon] ?? Circle} className={cn('size-4', catDone === c.steps.length ? 'text-green-600' : 'text-primary')} />
                    <Text className="text-sm font-semibold">{t(`app.sa_cat_${slug(c.title)}`, { defaultValue: c.title })}</Text>
                    <Text className="text-muted-foreground text-xs">{`${catDone}/${c.steps.length}`}</Text>
                  </View>
                  {c.steps.map((s, i) => {
                    const isDone = done.has(s.id);
                    const text = t(`app.sa_step_${s.id}`, { defaultValue: s.text });
                    return (
                      <View key={s.id} className="flex-row items-center gap-2 ps-6">
                        <Text className="text-muted-foreground w-4 text-end text-xs">{`${i + 1}.`}</Text>
                        <Pressable
                          onPress={() => complete(s.id)}
                          disabled={isDone}
                          hitSlop={6}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isDone }}
                          accessibilityLabel={isDone ? t('app.sa_completed') : t('app.sa_mark_done')}>
                          <Icon as={isDone ? CheckCircle2 : Circle} className={cn('size-4', isDone ? 'text-green-600' : 'text-muted-foreground')} />
                        </Pressable>
                        <Pressable className="flex-1" onPress={() => onOpen(s.href, text)} accessibilityRole="link">
                          <Text className={cn('text-sm', isDone ? 'text-muted-foreground line-through' : 'text-primary')}>{text}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            {allDone ? (
              <Button className="self-center bg-green-600" onPress={dismiss} disabled={dismissing}>
                <Text className="text-white">{dismissing ? t('app.sa_dismissing') : t('app.sa_done_hide')}</Text>
              </Button>
            ) : null}
          </View>
        )}
      </CardContent>
    </Card>
  );
}
