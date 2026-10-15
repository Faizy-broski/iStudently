import { FileDown, Printer } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** PDF + print buttons for a report page. */
export function ReportActions({ label, busy, ready, onRun }: { label: string; busy: boolean; ready: boolean; onRun: (mode: 'print' | 'pdf') => void }) {
  return (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="outline" onPress={() => onRun('pdf')} disabled={busy || !ready}>
        <Icon as={FileDown} className="text-foreground size-4" />
        <Text>PDF</Text>
      </Button>
      <Button className="flex-[2]" onPress={() => onRun('print')} disabled={busy || !ready}>
        <Icon as={Printer} className="text-primary-foreground size-4" />
        <Text numberOfLines={1}>{label}</Text>
      </Button>
    </View>
  );
}
