import { Search, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View className="relative justify-center">
      <Icon as={Search} className="text-muted-foreground absolute start-3 z-10 size-4" />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="ps-9 pe-9"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityRole="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} className="absolute end-3" accessibilityLabel="Clear">
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      ) : null}
    </View>
  );
}
