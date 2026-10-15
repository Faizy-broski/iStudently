import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { SchoolLogo } from '@/components/app/school-logo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';

/** Header title: school logo + current campus; admins tap it to pick a campus (web: CampusSwitcher). */
export function CampusSwitcher() {
  const { t } = useTranslation();
  const { me } = useSession();
  const { campuses, campus, canSwitch, setCampus } = useCampus();
  const [open, setOpen] = useState(false);
  const school = me.status === 'ready' ? me.me.school : null;
  const name = campus?.name ?? school?.name ?? '';
  const logo = campus?.logo_url ?? school?.logo_url;

  const title = (
    <View className="max-w-64 flex-row items-center gap-2">
      <SchoolLogo url={logo} size={28} shape={campus?.logo_shape ?? 'rounded'} />
      <Text className="shrink font-semibold" numberOfLines={1}>
        {name}
      </Text>
      {canSwitch ? <Icon as={ChevronDown} className="text-muted-foreground size-4" /> : null}
    </View>
  );
  if (!canSwitch) return title;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('app.cp_switch', { name })}>
        {title}
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-md p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{t('app.cp_title')}</DialogTitle>
          </DialogHeader>
          <ScrollView className="max-h-[60vh]">
            {campuses.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable
                  onPress={() => {
                    setCampus(c.id);
                    setOpen(false);
                  }}
                  className="active:bg-accent flex-row items-center gap-3 px-4 py-3"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: c.id === campus?.id }}>
                  <SchoolLogo url={c.logo_url} size={32} shape={c.logo_shape ?? 'rounded'} />
                  <View className="flex-1">
                    <Text numberOfLines={1}>{c.name}</Text>
                    {c.city ? <Text className="text-muted-foreground text-sm">{c.city}</Text> : null}
                  </View>
                  {c.id === campus?.id ? <Icon as={Check} className="text-primary size-5" /> : null}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
}
