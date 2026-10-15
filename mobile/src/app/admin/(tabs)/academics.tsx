import { TAB_GROUPS } from '@/features/admin/menu';
import { ModuleList } from '@/features/admin/module-list';

export default function AdminAcademics() {
  return <ModuleList only={TAB_GROUPS.academics} />;
}
