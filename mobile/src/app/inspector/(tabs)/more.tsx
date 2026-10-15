import { router } from 'expo-router';
import { BookOpenCheck, FileText, Settings as SettingsIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';

/** The rest of the inspector sidebar (reports, Hifzi compliance) and the app settings. */
export default function InspectorMore() {
  const { t } = useTranslation();
  return (
    <ScrollView className="bg-background flex-1">
      <ListRow title={t('sidebar.reports')} leading={<Icon as={FileText} className="text-muted-foreground size-5" />} onPress={() => router.push('/inspector/reports')} />
      <Separator />
      <ListRow title={t('sidebar.hifzi_compliance')} leading={<Icon as={BookOpenCheck} className="text-muted-foreground size-5" />} onPress={() => router.push('/inspector/hifzi-compliance')} />
      <Separator />
      <ListRow title={t('app.set_title')} leading={<Icon as={SettingsIcon} className="text-muted-foreground size-5" />} onPress={() => router.push('/settings')} />
    </ScrollView>
  );
}
