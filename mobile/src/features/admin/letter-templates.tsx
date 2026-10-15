import type { TemplateContext } from '@studently/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminLetterTemplates } from '@/lib/api';
import { useApi } from '@/lib/data';

type Action = 'na' | 'add' | 'update' | 'delete';

/** Pick a saved template to load it, or add / update / delete one from the current text (web: TemplateSelector). */
export function LetterTemplatePicker({ context, onLoad, getContent }: { context: TemplateContext; onLoad: (html: string) => void; getContent: () => string }) {
  const { t } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`app.lt_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'letter-templates', context, campusId ?? 'school'], () => adminLetterTemplates.list(context, campusId));
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState<Action>('na');
  const [name, setName] = useState('');
  const [global, setGlobal] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = res.data ?? [];

  async function run() {
    setBusy(true);
    try {
      if (action === 'add') {
        if (!name.trim()) return toast.error(l('name_required'));
        const r = await adminLetterTemplates.create({ name: name.trim(), context, content: getContent(), is_global: global, campus_id: campusId ?? null });
        if (!r.success || !r.data) return toast.error(r.error || l('save_failed'));
        toast.success(l('saved', { name: r.data.name }));
        setSelected(r.data.id);
      } else if (action === 'update') {
        const r = await adminLetterTemplates.update(selected, { content: getContent(), campus_id: campusId ?? null });
        if (!r.success || !r.data) return toast.error(r.error || l('update_failed'));
        toast.success(l('updated', { name: r.data.name }));
      } else if (action === 'delete') {
        if (!(await confirm({ title: t('common.delete'), body: list.find((x) => x.id === selected)?.name, destructive: true, confirmLabel: t('common.delete') }))) return;
        const r = await adminLetterTemplates.remove(selected, campusId);
        if (!r.success) return toast.error(r.error || l('delete_failed'));
        toast.success(l('deleted'));
        setSelected('');
      }
      setAction('na');
      setName('');
      res.mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="border-border gap-2 rounded-md border p-3">
      <Text className="text-xs font-semibold uppercase">{l('title')}</Text>
      <Label>{l('template')}</Label>
      <Picker
        value={selected}
        onChange={(v) => {
          setSelected(v);
          const tpl = list.find((x) => x.id === v);
          if (tpl) onLoad(tpl.content);
        }}
        placeholder={l('select')}
        options={list.map((x) => ({ value: x.id, label: x.is_global ? `${x.name} ${l('global')}` : x.name }))}
      />
      <Label>{l('action')}</Label>
      <Picker
        value={action}
        onChange={(v) => setAction(v as Action)}
        options={[
          { value: 'na', label: 'N/A' },
          { value: 'add', label: l('add') },
          { value: 'update', label: l('update'), disabled: !selected },
          { value: 'delete', label: l('delete'), disabled: !selected },
        ]}
      />
      {action === 'add' ? (
        <>
          <Label>{l('name')}</Label>
          <Input value={name} onChangeText={setName} placeholder={l('name_placeholder')} />
          <View className="flex-row items-center gap-3">
            <Switch checked={global} onCheckedChange={setGlobal} />
            <Text className="flex-1 text-sm">{l('is_global')}</Text>
          </View>
        </>
      ) : null}
      {action !== 'na' ? (
        <Button size="sm" variant={action === 'delete' ? 'destructive' : 'default'} onPress={run} disabled={busy}>
          <Text>{action === 'add' ? l('save_new') : action === 'update' ? l('update') : l('delete')}</Text>
        </Button>
      ) : null}
    </View>
  );
}
