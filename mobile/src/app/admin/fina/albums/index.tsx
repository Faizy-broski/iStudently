import { FinaAlbumsScreen } from '@/features/fina/albums';

/** Web: /admin/fina/albums. */
export default function AdminFinaAlbums() {
  return <FinaAlbumsScreen canCreate detail={(id) => ({ pathname: '/admin/fina/albums/[id]', params: { id } })} />;
}
