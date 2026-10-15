import { WorksheetLibrary } from '@/features/qirtasi/worksheet-library';

/** Web: /parent/qirtasi/worksheets. */
export default function ParentWorksheets() {
  return <WorksheetLibrary canUpload={false} />;
}
