import { Building2, Inbox } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { ListRow } from '@/components/app/list-row';
import { SchoolLogo } from '@/components/app/school-logo';
import { Screen } from '@/components/app/screen';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { locale, setLocale } from '@/i18n';
import { setThemePreference } from '@/lib/theme-preference';

// Dev-only gallery to review the design system on real devices (EN/AR, light/dark).
export default function Gallery() {
  const { colorScheme } = useColorScheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState('a');

  return (
    <Screen scroll edges={['bottom']}>
      <View className="flex-row flex-wrap gap-2">
        <Button size="sm" variant="outline" onPress={() => setThemePreference(colorScheme === 'dark' ? 'light' : 'dark')}>
          <Text>Theme: {colorScheme}</Text>
        </Button>
        <Button size="sm" variant="outline" onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
          <Text>{locale === 'ar' ? 'English' : 'العربية'}</Text>
        </Button>
      </View>

      <Text variant="h3">Typography</Text>
      <Text variant="large">Large text</Text>
      <Text>Body text — النص العربي يظهر هنا</Text>
      <Text variant="muted">Muted helper text</Text>

      <Text variant="h3">Buttons</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button><Text>Primary</Text></Button>
        <Button variant="secondary"><Text>Secondary</Text></Button>
        <Button variant="outline"><Text>Outline</Text></Button>
        <Button variant="destructive"><Text>Delete</Text></Button>
        <Button variant="ghost"><Text>Ghost</Text></Button>
        <Button disabled><Text>Disabled</Text></Button>
      </View>

      <Text variant="h3">Badges</Text>
      <View className="flex-row flex-wrap gap-2">
        <Badge><Text>Active</Text></Badge>
        <Badge variant="secondary"><Text>Trial</Text></Badge>
        <Badge variant="destructive"><Text>Suspended</Text></Badge>
        <Badge variant="outline"><Text>Draft</Text></Badge>
      </View>

      <Text variant="h3">Form</Text>
      <View className="gap-2">
        <Label>School name</Label>
        <Input placeholder="e.g. Al Noor School" />
        <Label>Notes</Label>
        <Textarea placeholder="Anything to remember" />
        <View className="flex-row items-center justify-between">
          <Label>Active</Label>
          <Switch checked={on} onCheckedChange={setOn} />
        </View>
        <View className="flex-row items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={setChecked} />
          <Label>Send welcome email</Label>
        </View>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search schools" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="a"><Text>Overview</Text></TabsTrigger>
          <TabsTrigger value="b"><Text>Billing</Text></TabsTrigger>
        </TabsList>
        <TabsContent value="a"><Text variant="muted">Overview content</Text></TabsContent>
        <TabsContent value="b"><Text variant="muted">Billing content</Text></TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Schools</CardTitle>
          <CardDescription>3 active, 1 suspended</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ListRow title="Al Noor School" subtitle="Tripoli · Active" leading={<SchoolLogo shape="circle" />} onPress={() => {}} />
          <Separator />
          <ListRow title="Green Valley" subtitle="Benghazi · Trial ends in 5 days" leading={<SchoolLogo shape="rectangle" />} onPress={() => {}} />
          <Separator />
          <ListRow title="Plain row" leading={<Icon as={Building2} className="text-muted-foreground size-5" />} />
        </CardContent>
      </Card>

      <Text variant="h3">Feedback</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" onPress={() => toast.success('Saved')}><Text>Toast ok</Text></Button>
        <Button variant="outline" onPress={() => toast.error('Could not save')}><Text>Toast error</Text></Button>
        <Button
          variant="destructive"
          onPress={async () => {
            const ok = await confirm({ title: 'Suspend school?', body: 'Its users will be signed out.', destructive: true, typeToConfirm: 'Al Noor School' });
            toast.info(ok ? 'Confirmed' : 'Cancelled');
          }}>
          <Text>Confirm dialog</Text>
        </Button>
      </View>

      <Text variant="h3">States</Text>
      <View className="border-border h-48 rounded-lg border"><LoadingList rows={2} /></View>
      <View className="border-border h-56 rounded-lg border"><EmptyState icon={Inbox} title="No feedback yet" body="New feedback from schools appears here." /></View>
    </Screen>
  );
}
