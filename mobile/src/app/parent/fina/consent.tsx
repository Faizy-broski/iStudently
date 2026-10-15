import { Stack } from 'expo-router';
import { Circle, CircleDot, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Ward = { studentId: string; firstName: string | null; lastName: string | null; sectionName: string | null; currentLevel: number };
// DENY_ALL, INNER_CIRCLE, CLASS_SCOPE, SCHOOL_SCOPE, SPECIAL_GRANT (backend consent-engine order).
const LEVELS = ['level_deny_all', 'level_inner_circle', 'level_class_scope', 'level_school_scope', 'level_special_grant'];
const SPECIAL = 4;

/**
 * Photo-consent for each child (web: /parent/fina/consent, ConsentLevelPicker): all five choices look
 * the same; a more private choice applies at once, a wider one asks for one confirmation; the
 * special grant needs a purpose. The canonical consent text is read from the server.
 */
export default function ParentFinaConsent() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`fina.consent.${key}`, o);
  const toast = useToast();
  const wards = useApi(['parent', 'fina-consent-wards'], () => fina.consentWards());
  const [active, setActive] = useState<Ward | null>(null);
  const [level, setLevel] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const text = useApi(textOpen ? ['parent', 'fina-consent-text'] : null, () => fina.consentText());
  const nameOf = (w: Ward) => [w.firstName, w.lastName].filter(Boolean).join(' ');

  function openWard(w: Ward) {
    setActive(w);
    setLevel(w.currentLevel);
    setPurpose('');
    setConfirming(false);
  }

  async function save() {
    if (!active) return;
    if (level === active.currentLevel) return setActive(null);
    if (level > active.currentLevel && !confirming) return setConfirming(true);
    if (level === SPECIAL && !purpose.trim()) return toast.error(k('purpose_required_error'));
    setSaving(true);
    const r = await fina.grantConsent({ student_id: active.studentId, level, purpose: level === SPECIAL ? purpose.trim() : undefined });
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('error_generic'));
    toast.success(k('toast_saved', { name: nameOf(active) }));
    setActive(null);
    wards.mutate();
  }

  const list = (wards.data ?? []) as Ward[];
  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => wards.mutate()} />}>
        <Text variant="muted">{k('page_subtitle')}</Text>
        {wards.isLoading ? (
          <LoadingList rows={2} />
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-2 py-10">
              <Icon as={Users} className="text-muted-foreground size-6" />
              <Text className="text-muted-foreground text-sm">{k('empty_wards')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((w) => (
            <Card key={w.studentId}>
              <CardContent className="flex-row items-center gap-3 py-4">
                <View className="flex-1">
                  <Text className="font-semibold">{nameOf(w)}</Text>
                  {w.sectionName ? <Text className="text-muted-foreground text-xs">{k('section_label', { section: w.sectionName })}</Text> : null}
                  <Text className="text-muted-foreground mt-1 text-sm">{k('current_label', { label: k(`${LEVELS[w.currentLevel]}_title`, { name: nameOf(w) }) })}</Text>
                </View>
                <Button variant="outline" onPress={() => openWard(w)}>
                  <Text>{k('change_button')}</Text>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-lg">
          {active ? (
            <ScrollView contentContainerClassName="gap-3">
              <DialogHeader>
                <DialogTitle>{nameOf(active)}</DialogTitle>
                <Text className="text-muted-foreground text-sm">{k('page_subtitle')}</Text>
              </DialogHeader>
              {confirming ? (
                <Text className="text-sm">{k('widen_confirm_body', { name: nameOf(active) })}</Text>
              ) : (
                <>
                  {LEVELS.map((key, i) => (
                    <Pressable
                      key={key}
                      onPress={() => setLevel(i)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: level === i }}
                      className={cn('flex-row items-start gap-3 rounded-lg border p-3', level === i ? 'border-[#022172] bg-[#022172]/5' : 'border-border')}>
                      <Icon as={level === i ? CircleDot : Circle} className={cn('mt-0.5 size-4', level === i ? 'text-[#022172]' : 'text-muted-foreground')} />
                      <View className="flex-1">
                        <Text className="text-sm font-medium">{k(`${key}_title`, { name: nameOf(active) })}</Text>
                        <Text className="text-muted-foreground mt-0.5 text-xs">{k(`${key}_desc`, { name: nameOf(active) })}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {level === SPECIAL ? (
                    <View className="gap-1.5">
                      <Label>{k('purpose_label')}</Label>
                      <Textarea value={purpose} onChangeText={setPurpose} placeholder={k('purpose_placeholder')} />
                    </View>
                  ) : null}
                  <Pressable onPress={() => setTextOpen(true)} accessibilityRole="link">
                    <Text className="text-xs text-[#022172] underline dark:text-blue-400">{k('read_text_link')}</Text>
                  </Pressable>
                </>
              )}
              <View className="flex-row justify-end gap-2">
                {confirming ? (
                  <Button variant="outline" onPress={() => setConfirming(false)} disabled={saving}>
                    <Text>{k('cancel_button')}</Text>
                  </Button>
                ) : null}
                <Button onPress={save} disabled={saving}>
                  <Text>{confirming ? k('widen_confirm_confirm') : k('save_button')}</Text>
                </Button>
              </View>
            </ScrollView>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{k('read_text_link')}</DialogTitle>
          </DialogHeader>
          <ScrollView style={{ maxHeight: 420 }}>
            <Text className="text-sm leading-relaxed">{text.isLoading ? k('consent_text_loading') : (text.data?.text ?? k('error_generic'))}</Text>
          </ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
}
