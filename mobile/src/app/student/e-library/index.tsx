import { ELibraryList } from '@/features/library/e-library-list';

/** Web: /student/e-library. */
export default function StudentELibrary() {
  return <ELibraryList readerPath="/student/e-library/[bookId]" />;
}
