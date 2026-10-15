import { ELibraryList } from '@/features/library/e-library-list';

/** Web: /librarian/e-library. */
export default function LibrarianELibrary() {
  return <ELibraryList readerPath="/librarian/e-library/[bookId]" />;
}
