import { htmlToText, textToHtml } from '@studently/shared-utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';

/** Tags beyond plain paragraphs/line breaks: text mode would drop them. */
const RICH = /<(?!\/?(p|br)\b)[a-z]/i;

type Sel = { start: number; end: number };

/**
 * HTML written by the web's rich-text editor, edited either as plain text (each line → <p>) or as
 * HTML source (lossless: keeps images, alignment, colors). Starts in source mode when the stored
 * HTML has formatting text mode can't keep. `insertRef` receives a function that inserts at the cursor.
 */
export function HtmlEditorField({
  value,
  onChange,
  placeholder,
  insertRef,
  insertHtmlRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  insertRef?: (insert: (token: string) => void) => void;
  /** Inserts markup (an image, a link): switches to source mode so the tags are kept. */
  insertHtmlRef?: (insert: (html: string) => void) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'text' | 'html'>(() => (RICH.test(value) ? 'html' : 'text'));
  const [text, setText] = useState(() => htmlToText(value));
  const [sel, setSel] = useState<Sel | null>(null);

  const switchMode = (m: 'text' | 'html') => {
    if (m === 'text') setText(htmlToText(value));
    setSel(null);
    setMode(m);
  };
  const setFromText = (v: string) => {
    setText(v);
    onChange(v.trim() ? textToHtml(v) : '');
  };
  const current = mode === 'html' ? value : text;
  const insert = (token: string) => {
    const at = sel ?? { start: current.length, end: current.length };
    const next = current.slice(0, at.start) + token + current.slice(at.end);
    if (mode === 'html') onChange(next);
    else setFromText(next);
    setSel({ start: at.start + token.length, end: at.start + token.length });
  };
  insertRef?.(insert);
  const insertHtml = (html: string) => {
    if (mode === 'html') return insert(html);
    // Cursor positions belong to the text view; in source mode the markup goes at the end.
    setSel(null);
    setMode('html');
    onChange(`${value}${html}`);
  };
  insertHtmlRef?.(insertHtml);

  return (
    <View className="gap-2">
      <FilterChips
        value={mode}
        onChange={switchMode}
        options={[
          { value: 'text', label: t('app.he_mode_text') },
          { value: 'html', label: t('app.he_mode_html') },
        ]}
      />
      <Textarea
        value={current}
        placeholder={placeholder}
        className={mode === 'html' ? 'min-h-36 font-mono text-xs' : 'min-h-32'}
        autoCapitalize={mode === 'html' ? 'none' : 'sentences'}
        autoCorrect={mode !== 'html'}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        onChangeText={(v) => (mode === 'html' ? onChange(v) : setFromText(v))}
      />
      {mode === 'text' && RICH.test(value) ? <Text className="text-warning text-xs">{t('app.rt_formatting_note')}</Text> : null}
    </View>
  );
}
