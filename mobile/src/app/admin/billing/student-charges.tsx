import type { ElementStatus, StudentElement } from '@studently/api-client';
import { todayIso } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { PickedStudent } from '@/features/admin/student-search';
import { useCampus } from '@/features/campus/campus';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { adminAcademics, adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const METHODS = ['cash', 'online', 'bank_deposit', 'cheque'] as const;
const METHOD_KEY: Record<string, string> = { cash: 'cash', online: 'online', bank_deposit: 'bank', cheque: 'cheque' };
const VARIANT: Record<ElementStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = { paid: 'default', partial: 'secondary', pending: 'outline', overdue: 'destructive', waived: 'secondary' };
const STATUS_KEY: Record<ElementStatus, string> = { pending: 'statusPending', partial: 'statusPartial', paid: 'statusPaid', overdue: 'statusOverdue', waived: 'statusWaived' };

/**
 * Students by grade/section/search, then one student's billing-element charges: add, edit (element, title,
 * amount, due date, comment), remove, take a payment (web: /admin/billing-elements/student-elements).
 */
export default function StudentCharges() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const { me } = useSession();
  const isAdmin = me.status === 'ready' && me.me.profile.role === 'admin';
  const e = (k: string, o?: Record<string, unknown>) => t(`admin.billing_elements.student_elements.${k}`, o);
  const { campusId } = useCampus();
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const studentId = student?.id ?? null;
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const roster = useApi(studentId ? null : ['admin', 'be-assign-students', gradeId, sectionId], ([, , g, sec]) => adminBillingElements.studentsForAssign((g as string) || undefined, (sec as string) || undefined));
  const q = search.trim().toLowerCase();
  const rosterList = (roster.data ?? []).filter((x) => !q || x.name.toLowerCase().includes(q) || (x.admission_number ?? '').toLowerCase().includes(q));
  const charges = useApi(studentId ? ['admin', 'student-charges', studentId] : null, () => adminBillingElements.studentElements({ student_id: studentId! }));
  const elements = useApi(['admin', 'billing-elements'], () => adminBillingElements.elements());
  const [adding, setAdding] = useState(false);
  const [elementId, setElementId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [paying, setPaying] = useState<StudentElement | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [busy, setBusy] = useState(false);

  async function addCharge() {
    const amt = parseFloat(amount) || 0;
    if (!student) return;
    if (!title.trim()) return toast.error(e('toast.element_title_required'));
    setBusy(true);
    const input = { billing_element_id: elementId || null, element_title: title.trim(), amount: amt, due_date: due || null, comment: comment.trim() || null };
    const res = editingId ? await adminBillingElements.updateStudentElement(editingId, input) : await adminBillingElements.assign(student.id, input);
    setBusy(false);
    if (!res.success) return toast.error(res.error || e('toast.operation_failed'));
    toast.success(editingId ? e('toast.saved') : e('toast.element_added'));
    setAdding(false);
    charges.mutate();
  }

  function openCharge(c?: StudentElement) {
    setEditingId(c?.id ?? null);
    setElementId(c?.billing_element_id ?? '');
    setTitle(c?.element_title ?? '');
    setAmount(c ? String(c.amount) : '');
    setDue(c?.due_date ?? '');
    setComment(c?.comment ?? '');
    setAdding(true);
  }

  async function pay() {
    const amt = parseFloat(payAmount);
    if (!paying || !student || !(amt > 0) || amt > paying.balance) return toast.error(t('app.be_pay_invalid'));
    setBusy(true);
    const res = await adminBillingElements.pay({ student_billing_element_id: paying.id, student_id: student.id, amount: amt, transaction_date: todayIso(), payment_method: method });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(t('fees.payments.paymentSaved'));
    setPaying(null);
    charges.mutate();
  }

  const list = charges.data ?? [];
  const total = list.reduce((sum, c) => sum + (c.balance ?? 0), 0);
  const totalAmount = list.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: t('app.be_student_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {!student ? (
          <>
            <Text variant="muted">{e('subtitle')}</Text>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Label>{e('grade')}</Label>
                <Picker
                  value={gradeId}
                  onChange={(v) => {
                    setGradeId(v);
                    setSectionId('');
                  }}
                  options={[{ value: '', label: t('fees.generate.allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
                />
              </View>
              <View className="flex-1 gap-1">
                <Label>{e('section')}</Label>
                <Picker value={sectionId} onChange={setSectionId} options={[{ value: '', label: t('common.all_sections') }, ...(sections.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
              </View>
            </View>
            <SearchBar value={search} onChangeText={setSearch} />
            <Text className="text-muted-foreground text-sm">{e('students_found', { count: rosterList.length })}</Text>
            {roster.isLoading ? <LoadingList rows={5} /> : null}
            {roster.data && rosterList.length === 0 ? <EmptyState title={e('no_students')} /> : null}
            {rosterList.length ? (
              <Card className="gap-0 py-0">
                {rosterList.map((x, i) => (
                  <View key={x.id}>
                    {i > 0 ? <Separator /> : null}
                    <Pressable onPress={() => setStudent({ id: x.id, name: x.name, number: x.admission_number, gradeId: x.grade_level_id })} className="active:bg-muted px-4 py-3">
                      <Text className="text-primary font-medium">{x.name}</Text>
                      <Text className="text-muted-foreground text-xs">{[`${e('admission_no')}: ${x.admission_number || e('dash')}`, `${e('grade_level')}: ${x.grade_level || e('dash')}`, x.section_name].filter(Boolean).join(' · ')}</Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
        {student ? (
          <>
            <Button variant="ghost" size="sm" className="self-start" onPress={() => setStudent(null)}>
              <Icon as={ArrowLeft} className="size-4 rtl:rotate-180" />
              <Text>{t('common.back')}</Text>
            </Button>
            <Text className="text-lg font-semibold">{`${student.name}${student.number ? ` · ${student.number}` : ''}`}</Text>
            <Text className="text-sm">{`${e('total_from_elements')}: ${money(totalAmount)}`}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{`${t('fees.balanceDue')}: ${money(total)}`}</Text>
              <Button size="sm" onPress={() => openCharge()}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{t('app.be_add_charge')}</Text>
              </Button>
            </View>
            {charges.isLoading ? <LoadingList rows={3} /> : null}
            {charges.data && list.length === 0 ? <EmptyState title={e('no_fees')} /> : null}
            {list.length ? (
              <Card className="gap-0 py-0">
                {list.map((c, i) => (
                  <View key={c.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="gap-1 px-4 py-3">
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="flex-1 font-medium">{c.element_title}</Text>
                        <Badge variant={VARIANT[c.status]}>
                          <Text>{t(`fees.${STATUS_KEY[c.status]}`)}</Text>
                        </Badge>
                      </View>
                      <Text className="text-muted-foreground text-xs">
                        {[`${money(c.amount_paid)} / ${money(c.amount)}`, c.category_title, `${e('assigned')}: ${c.assigned_date ? formatDate(c.assigned_date) : e('dash')}`, `${e('due')}: ${c.due_date ? formatDate(c.due_date) : e('dash')}`].filter(Boolean).join(' · ')}
                      </Text>
                      {c.comment ? <Text className="text-muted-foreground text-xs">{`${e('comment')}: ${c.comment}`}</Text> : null}
                      <View className="flex-row gap-4 pt-1">
                        {c.balance > 0 ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => {
                              setPayAmount(String(c.balance));
                              setPaying(c);
                            }}>
                            <Text className="text-primary text-sm">{t('app.be_take_payment')}</Text>
                          </Pressable>
                        ) : null}
                        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.edit')} onPress={() => openCharge(c)}>
                          <Icon as={Pencil} className="text-muted-foreground size-4" />
                        </Pressable>
                        {isAdmin ? (
                          <Pressable
                            hitSlop={8}
                            accessibilityLabel={t('app.bl_delete')}
                            onPress={async () => {
                              if (!(await confirm({ title: e('confirm.remove_element'), body: c.element_title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                              const res = await adminBillingElements.deleteStudentElement(c.id);
                              if (!res.success) return toast.error(res.error || t('app.error_title'));
                              charges.mutate();
                            }}>
                            <Icon as={Trash2} className="text-muted-foreground size-4" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t('common.edit') : t('app.be_add_charge')}</DialogTitle>
          </DialogHeader>
          <Label>{t('app.be_element')}</Label>
          <Picker
            value={elementId}
            onChange={(v) => {
              setElementId(v);
              const el = elements.data?.find((x) => x.id === v);
              if (el) {
                setTitle(el.title);
                setAmount(String(el.amount));
              }
            }}
            placeholder={t('app.be_pick_element')}
            options={[{ value: '', label: e('dash') }, ...(elements.data ?? []).filter((x) => x.is_active).map((x) => ({ value: x.id, label: `${x.title} · ${money(x.amount)}` }))]}
          />
          <Label>{t('app.be_name')}</Label>
          <Input value={title} onChangeText={setTitle} />
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          <Label>{t('app.fe_due_date')}</Label>
          <DateField value={due || null} onChange={(v) => setDue(v ?? '')} clearable />
          <Label>{e('comment')}</Label>
          <Input value={comment} onChangeText={setComment} />
          <DialogFooter>
            <Button onPress={addCharge} disabled={busy}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{paying?.element_title ?? ''}</DialogTitle>
          </DialogHeader>
          <Label>{fees(t, 'th_amount')}</Label>
          <Input value={payAmount} onChangeText={(v) => setPayAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          <Label>{fees(t, 'th_method')}</Label>
          <FilterChips<(typeof METHODS)[number]> value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: fees(t, METHOD_KEY[m]) }))} />
          <DialogFooter>
            <Button onPress={pay} disabled={busy}>
              <Text>{t('app.be_take_payment')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fees(t: (k: string) => string, k: string) {
  return t(`fees.payments.${k}`);
}
