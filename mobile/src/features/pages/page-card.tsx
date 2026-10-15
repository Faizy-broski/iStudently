import { htmlToText } from '@studently/shared-utils';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Code2, ExternalLink, FileText, Image as ImageIcon, Link2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** A custom page (school pages, login "About" pages): link, embed, text or image. */
export interface CustomPage {
  id: string;
  title: string;
  page_type: 'url' | 'embed' | 'text' | 'image';
  url?: string;
  content?: string;
  image_url?: string;
}

function Title({ icon, title }: { icon: typeof Link2; title: string }) {
  return (
    <View className="flex-row items-center gap-2 p-3">
      <Icon as={icon} className="text-primary size-4" />
      <Text className="flex-1 text-sm font-medium">{title}</Text>
    </View>
  );
}

export function PageCard({ page }: { page: CustomPage }) {
  if (page.page_type === 'url' && page.url) {
    const url = page.url;
    return (
      <Pressable onPress={() => WebBrowser.openBrowserAsync(url)} accessibilityRole="link">
        <Card>
          <CardContent className="flex-row items-center gap-3 p-4">
            <Icon as={Link2} className="text-primary size-5" />
            <Text className="flex-1 text-sm font-medium">{page.title}</Text>
            <Icon as={ExternalLink} className="text-muted-foreground size-4" />
          </CardContent>
        </Card>
      </Pressable>
    );
  }
  if (page.page_type === 'embed' && page.url) {
    return (
      <Card className="overflow-hidden">
        <Title icon={Code2} title={page.title} />
        <View style={{ height: 480 }}>
          <WebView source={{ uri: page.url }} style={{ flex: 1 }} />
        </View>
      </Card>
    );
  }
  if (page.page_type === 'text') {
    return (
      <Card>
        <Title icon={FileText} title={page.title} />
        <CardContent className="pt-0">
          <Text className="text-sm">{htmlToText(page.content ?? '')}</Text>
        </CardContent>
      </Card>
    );
  }
  if (page.page_type === 'image' && page.image_url) {
    return (
      <Card className="overflow-hidden">
        <Title icon={ImageIcon} title={page.title} />
        <Image source={{ uri: page.image_url }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="contain" accessibilityLabel={page.title} />
      </Card>
    );
  }
  return null;
}
