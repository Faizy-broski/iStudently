import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, ImagePlus, Italic, Link2, List, ListOrdered, Palette, Underline, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { FilterChips } from '@/components/app/filter-chips';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { media } from '@/lib/api';
import { colors, useColors } from '@/lib/colors';
import { pickImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

type Cmd = { cmd: string; value?: string };

/** Editor page: a contenteditable body that reports its HTML and height, and runs commands (document.execCommand, like the web editors). */
function editorHtml(initial: string, placeholder: string, rtl: boolean, minHeight: number, c: { text: string; muted: string; bg: string; link: string; border: string }) {
  return `<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
html,body{margin:0;padding:0;background:${c.bg};color:${c.text};font:15px -apple-system,system-ui,Roboto,sans-serif}
#e{min-height:${minHeight}px;padding:10px 12px;outline:none;line-height:1.5;word-wrap:break-word}
#e:empty:before{content:attr(data-ph);color:${c.muted}}
#e img{max-width:100%;height:auto}#e a{color:${c.link}}#e table{border-collapse:collapse}#e td,#e th{border:1px solid ${c.border};padding:4px}
</style></head><body><div id="e" contenteditable="true" data-ph="${placeholder.replace(/"/g, '&quot;')}"></div><script>
var e=document.getElementById('e');e.innerHTML=${JSON.stringify(initial)};
function post(){window.ReactNativeWebView.postMessage(JSON.stringify({html:e.innerHTML,height:Math.max(document.body.scrollHeight,e.scrollHeight)}));}
var t;e.addEventListener('input',function(){clearTimeout(t);t=setTimeout(post,150);});
var saved=null;document.addEventListener('selectionchange',function(){var s=window.getSelection();if(s.rangeCount&&e.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange();});
function restore(){e.focus();if(saved){var s=window.getSelection();s.removeAllRanges();s.addRange(saved);}}
window.run=function(cmd,val){restore();document.execCommand('styleWithCSS',false,cmd==='foreColor');document.execCommand(cmd,false,val||null);post();};
window.insert=function(html){restore();document.execCommand('insertHTML',false,html);post();};
window.setHtml=function(h){e.innerHTML=h;post();};
setTimeout(post,50);
</script></body></html>`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Rich-text editor for HTML the web edits with its RichTextEditor: bold/italic/underline, lists, alignment,
 * text colour, links and images (uploaded through the media API), on a WebView with a native toolbar.
 * `insertRef` receives a function that inserts text (e.g. a {{token}}) or HTML at the cursor.
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
  minHeight = 160,
  images = true,
  campusId,
  insertRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  images?: boolean;
  campusId?: string;
  insertRef?: (insert: (content: string, asHtml?: boolean) => void) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const c = useColors();
  const web = useRef<WebView>(null);
  const [height, setHeight] = useState(minHeight + 24);
  const [panel, setPanel] = useState<'color' | 'link' | null>(null);
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  // The page is built once with the starting HTML; later edits come back through messages.
  const [html] = useState(() =>
    editorHtml(value || '', placeholder ?? '', locale === 'ar', minHeight, { text: colors.foreground, muted: colors.mutedForeground, bg: colors.card, link: colors.brandSecondary, border: colors.border }),
  );

  const js = (code: string) => web.current?.injectJavaScript(`${code};true;`);
  const run = ({ cmd, value: v }: Cmd) => js(`window.run(${JSON.stringify(cmd)},${JSON.stringify(v ?? null)})`);
  const insert = (content: string, asHtml = false) => js(`window.insert(${JSON.stringify(asHtml ? content : esc(content))})`);

  useEffect(() => {
    insertRef?.(insert);
  });

  function onMessage(ev: WebViewMessageEvent) {
    try {
      const m = JSON.parse(ev.nativeEvent.data) as { html: string; height: number };
      onChange(m.html);
      setHeight(Math.max(minHeight + 24, Math.ceil(m.height) + 8));
    } catch {
      // ignore malformed messages
    }
  }

  async function addImage() {
    const picked = await pickImage({ maxDimension: 1600 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const r = await media.uploadAttachment(picked.file, campusId);
    setUploading(false);
    if (!r.success || !r.data) return toast.error(r.error || t('app.error_title'));
    insert(`<img src="${esc(r.data.url)}" alt="" />`, true);
  }

  type ToolId = 'bold' | 'italic' | 'underline' | 'ul' | 'ol' | 'start' | 'center' | 'end' | 'color' | 'link' | 'image' | 'clear';
  const tools: { id: ToolId; icon: LucideIcon; label: string; on?: boolean }[] = [
    { id: 'bold', icon: Bold, label: t('common.bold') },
    { id: 'italic', icon: Italic, label: t('common.italic') },
    { id: 'underline', icon: Underline, label: t('common.underline') },
    { id: 'ul', icon: List, label: t('common.bullet_list') },
    { id: 'ol', icon: ListOrdered, label: t('common.numbered_list') },
    { id: 'start', icon: AlignLeft, label: t('common.align_left') },
    { id: 'center', icon: AlignCenter, label: t('common.align_center') },
    { id: 'end', icon: AlignRight, label: t('common.align_right') },
    { id: 'color', icon: Palette, label: t('app.rt_color'), on: panel === 'color' },
    { id: 'link', icon: Link2, label: t('app.rt_link'), on: panel === 'link' },
    ...(images ? [{ id: 'image' as const, icon: ImagePlus, label: t('app.rt_image') }] : []),
    { id: 'clear', icon: Eraser, label: t('app.rt_clear') },
  ];
  // Toolbar actions (event handlers only, so the WebView ref is never read during render).
  function act(id: ToolId) {
    const rtl = locale === 'ar';
    const cmds: Partial<Record<ToolId, string>> = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      ul: 'insertUnorderedList',
      ol: 'insertOrderedList',
      start: rtl ? 'justifyRight' : 'justifyLeft',
      center: 'justifyCenter',
      end: rtl ? 'justifyLeft' : 'justifyRight',
      clear: 'removeFormat',
    };
    if (id === 'color' || id === 'link') setPanel((p) => (p === id ? null : id));
    else if (id === 'image') addImage();
    else if (cmds[id]) run({ cmd: cmds[id] as string });
  }
  // Text colours offered (the web editors offer black, red, blue, green, orange, purple).
  const palette = [c.foreground, c.destructive, c.brand, c.success, c.brandAccent, c.chart6, c.mutedForeground];

  return (
    <View className="border-input overflow-hidden rounded-xl border">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" className="border-input bg-muted/40 border-b" contentContainerClassName="items-center gap-0.5 px-1 py-1">
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => act(tool.id)}
            className={cn('size-9 items-center justify-center rounded-lg active:opacity-60', tool.on && 'bg-info-soft')}
            accessibilityRole="button"
            accessibilityLabel={tool.label}>
            <Icon as={tool.icon} className="text-foreground size-4" />
          </Pressable>
        ))}
        {uploading ? <ActivityIndicator size="small" /> : null}
      </ScrollView>
      {panel === 'color' ? (
        <View className="border-input flex-row flex-wrap gap-2 border-b p-2">
          {palette.map((col) => (
            <Pressable
              key={col}
              onPress={() => {
                run({ cmd: 'foreColor', value: col });
                setPanel(null);
              }}
              className="border-border size-7 rounded-full border"
              style={{ backgroundColor: col }}
              accessibilityRole="button"
              accessibilityLabel={col}
            />
          ))}
        </View>
      ) : null}
      {panel === 'link' ? (
        <View className="border-input flex-row items-center gap-2 border-b p-2">
          <Input className="h-9 flex-1" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" />
          <Button
            size="sm"
            onPress={() => {
              const href = url.trim();
              if (href) run({ cmd: 'createLink', value: /^https?:\/\//i.test(href) ? href : `https://${href}` });
              setUrl('');
              setPanel(null);
            }}>
            <Text>{t('app.rt_add_link')}</Text>
          </Button>
        </View>
      ) : null}
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        scrollEnabled={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        style={{ height, backgroundColor: c.card }}
      />
    </View>
  );
}

/**
 * Visual editor (formatting toolbar, like the web) with an "HTML" switch for raw source editing
 * (keeps anything the visual editor can't show). Token/markup inserts go to whichever is open.
 */
export function RichOrSourceField({
  value,
  onChange,
  placeholder,
  campusId,
  insertRef,
  insertHtmlRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  campusId?: string;
  insertRef?: (insert: (token: string) => void) => void;
  insertHtmlRef?: (insert: (html: string) => void) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [nonce, setNonce] = useState(0);
  return (
    <View className="gap-2">
      <FilterChips<'visual' | 'html'>
        value={mode}
        onChange={(m) => {
          setMode(m);
          setNonce((n) => n + 1);
        }}
        options={[
          { value: 'visual', label: t('app.rt_visual') },
          { value: 'html', label: 'HTML' },
        ]}
      />
      {mode === 'visual' ? (
        <RichTextField
          key={`v-${nonce}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          campusId={campusId}
          insertRef={(fn) => {
            insertRef?.((tok) => fn(tok));
            insertHtmlRef?.((html) => fn(html, true));
          }}
        />
      ) : (
        <HtmlEditorField key={`h-${nonce}`} value={value} onChange={onChange} placeholder={placeholder} insertRef={insertRef} insertHtmlRef={insertHtmlRef} />
      )}
    </View>
  );
}
