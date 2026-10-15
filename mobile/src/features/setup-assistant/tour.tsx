import { TOUR_STEPS, type SetupAssistantRole } from '@studently/shared-types';
import Storage from 'expo-sqlite/kv-store';
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSWRConfig } from 'swr';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Award, BookOpen, Building2, Calendar, CalendarCheck, ChartColumn, CircleAlert, ClipboardList, Clock, CreditCard, DollarSign, Eye, FileText, FolderOpen, GraduationCap, Layers, LayoutDashboard, Megaphone, MessageSquare, Settings, SlidersVertical, Upload, UserCheck, Users,
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const ROLES: SetupAssistantRole[] = ['admin', 'teacher', 'student', 'parent', 'librarian'];

type TourState = { active: boolean; step: number };

/**
 * Web TourAssistantPanel: a floating welcome card, then one card per step that opens the step's
 * page; Back / Next / Finish, cancel. Shown with the setup_assistant plugin when the user's role is
 * enabled and the assistant was not dismissed; the current step is kept on the device.
 */
export function TourAssistant({ onOpen }: { onOpen: (href: string, title: string) => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.tour_${key}`, o);
  const insets = useSafeAreaInsets();
  const { mutate } = useSWRConfig();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const role = profile && (ROLES as string[]).includes(profile.role) ? (profile.role as SetupAssistantRole) : null;
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const config = settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined;
  const enabled = !!role && plugins.includes('setup_assistant') && !!config?.[role];
  const progress = useApi(enabled ? ['portal', 'setup-progress'] : null, () => portal.setupProgress());
  const key = `tour.step.${profile?.id ?? ''}.${role ?? ''}`;
  const [state, setState] = useState<TourState | null>(() => {
    try {
      const raw = Storage.getItemSync(key);
      return raw ? (JSON.parse(raw) as TourState) : null;
    } catch {
      return null;
    }
  });
  const [gone, setGone] = useState(false);

  const steps = role ? TOUR_STEPS[role] : [];
  if (!enabled || !progress.data || progress.data.dismissed || gone || !steps.length) return null;
  const s = state ?? { active: false, step: 0 };

  const save = (next: TourState | null) => {
    setState(next);
    try {
      if (next) Storage.setItemSync(key, JSON.stringify(next));
      else Storage.removeItemSync(key);
    } catch {
      // storage unavailable
    }
  };
  const go = (i: number) => {
    save({ active: true, step: i });
    const st = steps[i];
    onOpen(st.href, k(`${st.id}_t`, { defaultValue: st.title }));
  };
  const dismiss = () => {
    save(null);
    setGone(true);
    portal.dismissSetupAssistant().then(() => mutate((x) => Array.isArray(x) && x[0] === 'portal' && x[1] === 'setup-progress'));
  };

  const wrap = 'absolute inset-x-3 overflow-hidden rounded-2xl border border-[#022172]/20 bg-card shadow-lg';
  if (!s.active) {
    return (
      <View className={wrap} style={{ bottom: insets.bottom + 64 }}>
        <View className="flex-row items-start gap-3 bg-[#022172] p-4">
          <View className="size-9 items-center justify-center rounded-lg bg-white/15">
            <Icon as={Sparkles} className="size-5 text-[#EEA831]" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-white">{k('welcome')}</Text>
            <Text className="mt-1 text-xs text-white/80">{k('welcome_body')}</Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('skip')}>
            <Icon as={X} className="size-4 text-white/80" />
          </Pressable>
        </View>
        <View className="flex-row items-center justify-between gap-2 p-3">
          <Text className="text-muted-foreground text-xs">{k('steps', { count: steps.length })}</Text>
          <Button size="sm" className="bg-[#022172]" onPress={() => go(0)}>
            <Text className="text-white">{k('start')}</Text>
          </Button>
        </View>
      </View>
    );
  }

  const i = Math.min(s.step, steps.length - 1);
  const st = steps[i];
  const last = i === steps.length - 1;
  return (
    <View className={wrap} style={{ bottom: insets.bottom + 64 }}>
      <View className="bg-muted h-1">
        <View className="h-full bg-[#EEA831]" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </View>
      <View className="flex-row items-start gap-3 bg-[#022172] px-4 py-3">
        <View className="size-9 items-center justify-center rounded-lg bg-white/15">
          <Icon as={ICONS[st.icon] ?? Sparkles} className="size-4 text-white" />
        </View>
        <View className="flex-1">
          <Text className="text-[10px] font-semibold tracking-widest text-[#EEA831] uppercase">{k(`cat_${slug(st.category)}`, { defaultValue: st.category })}</Text>
          <Text className="text-sm font-bold text-white">{k(`${st.id}_t`, { defaultValue: st.title })}</Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
          <Icon as={Sparkles} className="size-3 text-[#EEA831]" />
          <Text className="text-xs font-semibold text-white">{`${i + 1}/${steps.length}`}</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('cancel')}>
          <Icon as={X} className="size-4 text-white/80" />
        </Pressable>
      </View>
      <Text className="text-muted-foreground px-4 py-3 text-sm">{k(`${st.id}_d`, { defaultValue: st.description })}</Text>
      <View className="flex-row items-center gap-1 px-4">
        {steps.map((x, j) => (
          <View key={x.id} className={cn('h-1 rounded-full', j === i ? 'w-6 bg-[#022172]' : j < i ? 'flex-1 bg-[#022172]/30' : 'bg-muted flex-1')} />
        ))}
      </View>
      <View className="flex-row justify-between gap-2 p-3">
        <Button size="sm" variant="outline" disabled={i === 0} onPress={() => go(i - 1)}>
          <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
          <Text>{k('back')}</Text>
        </Button>
        <Button size="sm" className="bg-[#022172]" onPress={() => (last ? dismiss() : go(i + 1))}>
          <Text className="text-white">{last ? k('finish') : k('next')}</Text>
          {last ? null : <Icon as={ChevronRight} className="size-4 text-white rtl:rotate-180" />}
        </Button>
      </View>
    </View>
  );
}
