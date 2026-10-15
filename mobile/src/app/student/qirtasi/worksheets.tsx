import { WorksheetLibrary } from '@/features/qirtasi/worksheet-library';

/** Browse and download worksheets (web: /student/qirtasi/worksheets). */
export default function StudentWorksheets() {
  return <WorksheetLibrary canUpload={false} />;
}
