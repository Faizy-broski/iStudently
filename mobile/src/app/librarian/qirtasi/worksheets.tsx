import { WorksheetLibrary } from '@/features/qirtasi/worksheet-library';

/** Web: /librarian/qirtasi/worksheets (and /librarian/worksheets). */
export default function LibrarianWorksheets() {
  return <WorksheetLibrary canUpload />;
}
