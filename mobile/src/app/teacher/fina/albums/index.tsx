import { FinaAlbumsScreen } from '@/features/fina/albums';

/** Web: /teacher/fina/albums. */
export default function TeacherFinaAlbums() {
  return <FinaAlbumsScreen canCreate detail={(id) => ({ pathname: '/teacher/fina/albums/[id]', params: { id } })} />;
}
