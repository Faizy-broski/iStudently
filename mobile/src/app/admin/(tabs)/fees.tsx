import { FeesOverview } from '@/features/admin/fees-overview';
import { TAB_GROUPS } from '@/features/admin/menu';
import { ModuleList } from '@/features/admin/module-list';

export default function AdminFees() {
  return <ModuleList only={TAB_GROUPS.fees} header={<FeesOverview />} />;
}
