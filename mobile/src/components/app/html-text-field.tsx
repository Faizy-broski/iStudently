import { htmlToText, textToHtml } from '@studently/shared-utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';

/** Tags beyond plain paragraphs/line breaks: editing here would drop them. */
const RICH = /<(?!\/?(p|br)\b)[a-z]/i;

/**
 * Edits HTML written by the web's rich-text editor as plain text. The stored HTML is left untouched
 * until the user types; then each line becomes a <p>. Warns when that would drop web formatting.
 */
export function HtmlTextField({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => htmlToText(value));
  const [edited, setEdited] = useState(false);
  const rich = !edited && RICH.test(value);
  return (
    <View className="gap-1.5">
      <Textarea
        value={text}
        placeholder={placeholder}
        className="min-h-32"
        onChangeText={(v) => {
          setText(v);
          setEdited(true);
          onChange(v.trim() ? textToHtml(v) : '');
        }}
      />
      {rich ? <Text className="text-warning text-xs">{t('app.rt_formatting_note')}</Text> : null}
    </View>
  );
}
