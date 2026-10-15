import { FinaAlbumsScreen } from '@/features/fina/albums';

/** Web: /parent/fina/albums. */
export default function ParentFinaAlbums() {
  return <FinaAlbumsScreen canCreate={false} detail={(id) => ({ pathname: '/parent/fina/albums/[id]', params: { id } })} />;
}
