import { ELibraryList } from '@/features/library/e-library-list';

/** Web: /admin/library/e-library. */
export default function ELibrary() {
  return <ELibraryList readerPath="/admin/library/e-library/[bookId]" />;
}
